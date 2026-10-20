/* C.W.B Japan Car Import module.
   Upload to the ROOT of the existing GitHub Pages repository.
   This file is not active until index.html registers it and Supabase SQL is applied.
*/
(function () {
  'use strict';
  const db = () => window.cwbSupabaseClient;
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const usd = v => Number(v || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const vehicleStates = ['Ordered','Purchased','Shipped','Arrived in Burundi','Delivered'];
  const dhlStates = ['Not dispatched','In transit','Received in Burundi'];
  let isCEO = false, user = null, orders = [], payments = [], receipts = [];

  function note(text, bad) {
    const el = $('jiMessage');
    if (el) { el.textContent = text; el.style.color = bad ? '#b91c1c' : '#166534'; }
  }
  function styles() {
    if ($('cwbJapanStyle')) return;
    const s = document.createElement('style'); s.id = 'cwbJapanStyle';
    s.textContent = `
      #japanImport{color:#111827}#japanImport .ji-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
      #japanImport label{display:block;font-weight:600;margin:7px 0 4px}#japanImport input,#japanImport select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
      #japanImport button{cursor:pointer;border:0;border-radius:8px;padding:10px 13px;margin:4px 3px 4px 0;background:#b91c1c;color:white;font-weight:600}#japanImport button.secondary{background:#374151}
      #japanImport .ji-panel{border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin:14px 0;background:#fff}#japanImport .ji-tablewrap{overflow:auto}
      #japanImport table{width:100%;border-collapse:collapse;min-width:830px}#japanImport th,#japanImport td{border-bottom:1px solid #e5e7eb;padding:9px;text-align:left;vertical-align:top}#japanImport th{background:#f3f4f6}
      #japanImport .ji-small{font-size:12px;color:#6b7280}#japanImport .ji-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px}#japanImport .ji-stat{background:#f3f4f6;padding:12px;border-radius:9px}#japanImport .ji-stat strong{display:block;font-size:18px;margin-top:5px}
      @media(max-width:600px){#japanImport .ji-panel{padding:10px}#japanImport h2{font-size:21px}}
    `; document.head.appendChild(s);
  }
  function buildUI() {
    const dashboard = document.querySelector('.dashboard');
    if (dashboard && !$('japanImportNav')) {
      const b = document.createElement('button'); b.id = 'japanImportNav'; b.className = 'module';
      b.setAttribute('onclick', "showModule('japanImport')"); b.textContent = 'Japan Car Import'; dashboard.appendChild(b);
    }
    if ($('japanImport')) return;
    const container = document.querySelector('.container'); if (!container) return;
    const section = document.createElement('div'); section.id = 'japanImport'; section.className = 'card hidden';
    section.innerHTML = `
      <h2>Japan Car Import / Importation de voitures du Japon</h2>
      <p>Vehicle register, customer costs, DHL documents and C.W.B commission are kept separate.</p>
      <div class="ji-panel"><h3>Register a vehicle / Enregistrer un véhicule</h3>
        <div class="ji-grid">
          <div><label>Customer / Client *</label><input id="jiCustomer" required></div><div><label>Customer phone / Téléphone</label><input id="jiPhone"></div>
          <div><label>Make and model / Marque et modèle *</label><input id="jiMake" required></div><div><label>Year / Année</label><input id="jiYear" type="number" min="1950" max="2100"></div>
          <div><label>VIN / Chassis</label><input id="jiVin"></div><div><label>Japan supplier / Fournisseur au Japon</label><input id="jiSupplier"></div>
          <div><label>Vehicle price (USD) / Prix véhicule</label><input id="jiPrice" type="number" min="0" step=".01" value="0"></div>
          <div><label>Bank fee (USD) / Frais bancaires</label><input id="jiBank" type="number" min="0" step=".01" value="0"></div>
          <div><label>Shipping (USD) / Transport</label><input id="jiShipping" type="number" min="0" step=".01" value="0"></div>
          <div><label>Clearing and other costs (USD) / Dédouanement et autres frais</label><input id="jiClearing" type="number" min="0" step=".01" value="0"></div>
          <div><label>Notes / Remarques</label><input id="jiNotes"></div>
        </div>
        <p><b>Customer total / Total client:</b> <span id="jiCustomerTotal">0.00</span> USD. <b>C.W.B commission is excluded.</b></p>
        <button type="button" id="jiSaveOrder">Save vehicle / Enregistrer</button><button type="button" class="secondary" id="jiRefresh">Refresh / Actualiser</button>
      </div>
      <div id="jiMessage" role="status" aria-live="polite"></div>
      <div class="ji-panel"><h3>Vehicle register / Registre des véhicules</h3><div class="ji-tablewrap"><table><thead><tr><th>Order / Customer</th><th>Vehicle</th><th>Customer total</th><th>Vehicle status</th><th>DHL documents</th><th>C.W.B commission</th><th>Actions</th></tr></thead><tbody id="jiOrderRows"><tr><td colspan="7">Loading…</td></tr></tbody></table></div></div>
      <div class="ji-panel"><h3>Customer payment claims / Paiements clients</h3><p class="ji-small">Payment claims remain PENDING until the CEO checks and confirms the real transaction.</p>
        <div class="ji-grid"><div><label>Vehicle order / Dossier véhicule</label><select id="jiPaymentOrder"></select></div><div><label>Amount (USD) / Montant</label><input id="jiPaymentAmount" type="number" min=".01" step=".01"></div><div><label>Method / Mode de paiement</label><select id="jiPaymentMethod"><option>Bank transfer</option><option>Mobile money</option><option>Cash</option><option>Other</option></select></div><div><label>Reference / Référence</label><input id="jiPaymentReference"></div></div>
        <button type="button" id="jiSubmitPayment">Submit payment claim / Soumettre</button><div class="ji-tablewrap"><table><thead><tr><th>Order</th><th>Amount</th><th>Method / reference</th><th>Status</th><th>CEO action</th></tr></thead><tbody id="jiPaymentRows"><tr><td colspan="5">No claims loaded.</td></tr></tbody></table></div>
      </div>
      <div class="ji-panel"><h3>C.W.B commission report / Rapport des commissions</h3><div id="jiCommissionSummary" class="ji-summary"></div><p class="ji-small">Standard commission: $100 per vehicle. Commission becomes payable only when DHL documents are received in Burundi. Discounts require CEO authorization and a reason. Customer payments are never counted as C.W.B commission.</p></div>`;
    container.appendChild(section);
    ['jiPrice','jiBank','jiShipping','jiClearing'].forEach(id => $(id).addEventListener('input', total));
    $('jiSaveOrder').addEventListener('click', saveOrder); $('jiRefresh').addEventListener('click', refresh);
    $('jiSubmitPayment').addEventListener('click', submitPayment);
  }
  function total() {
    const n = ['jiPrice','jiBank','jiShipping','jiClearing'].reduce((a,id)=>a+Number($(id)?.value||0),0);
    if ($('jiCustomerTotal')) $('jiCustomerTotal').textContent = usd(n);
  }
  async function checkUser() {
    const client = db(); if (!client) throw new Error('C.W.B Supabase client is not available.');
    const {data,error} = await client.auth.getUser(); if (error) throw error;
    if (!data?.user) throw new Error('Please sign in to C.W.B System first.'); user = data.user;
    const {data:p,error:pe} = await client.from('cwb_profiles').select('id,active,role_id').eq('id',user.id).maybeSingle();
    if (pe) throw pe; if (!p || p.active === false) throw new Error('An active C.W.B user profile is required.');
    let role = 'User'; if (p.role_id) { const {data:r,error:re}=await client.from('cwb_roles').select('name').eq('id',p.role_id).maybeSingle(); if(re) throw re; role=r?.name||'User'; }
    isCEO = role.trim().toUpperCase() === 'CEO';
  }
  async function saveOrder() {
    const client = db(), customer = $('jiCustomer').value.trim(), make = $('jiMake').value.trim();
    if (!customer || !make) return note('Customer and make/model are required. / Le client et le véhicule sont obligatoires.',true);
    const ids = ['jiPrice','jiBank','jiShipping','jiClearing']; if(ids.some(id=>Number($(id).value||0)<0)) return note('Costs cannot be negative.',true);
    const b=$('jiSaveOrder'); b.disabled=true;
    try {
      const {error}=await client.from('cwb_japan_import_orders').insert({customer,phone:$('jiPhone').value.trim()||null,make,year:$('jiYear').value?Number($('jiYear').value):null,vin:$('jiVin').value.trim()||null,supplier:$('jiSupplier').value.trim()||null,price:Number($('jiPrice').value||0),bank_fee:Number($('jiBank').value||0),shipping:Number($('jiShipping').value||0),clearing:Number($('jiClearing').value||0),notes:$('jiNotes').value.trim()||null,vehicle_status:'Ordered',dhl_status:'Not dispatched'});
      if(error) throw error; note('Vehicle saved successfully. Customer total excludes C.W.B commission.',false);
      ['jiCustomer','jiPhone','jiMake','jiYear','jiVin','jiSupplier','jiNotes'].forEach(id=>$(id).value=''); ids.forEach(id=>$(id).value='0'); total(); await refresh();
    } catch(e) { note('Save failed: '+(e.message||e)+'. Check that the Japan Import SQL setup has been run in Supabase.',true); }
    finally { b.disabled=false; }
  }
  async function updateOrder(id, fields) {
    const {error}=await db().from('cwb_japan_import_orders').update(fields).eq('id',id);
    if(error){note('Update failed: '+error.message,true);return;} await refresh();
  }
  async function discount(id) {
    if(!isCEO) return note('Only the CEO can authorize a commission discount.',true);
    const raw=prompt('Commission discount from $0 to $100:','0'); if(raw===null)return;
    const amount=Number(raw); if(!Number.isFinite(amount)||amount<0||amount>100)return note('Discount must be between $0 and $100.',true);
    let reason=''; if(amount>0){reason=(prompt('Required reason for the discount:','')||'').trim();if(!reason)return note('A reason is required for every discount.',true);}
    const {error}=await db().rpc('cwb_japan_authorize_discount',{p_order_id:id,p_discount:amount,p_reason:reason});
    if(error)return note('Discount authorization failed: '+error.message,true); note('CEO discount authorization saved.',false); await refresh();
  }
  async function submitPayment() {
    const order_id=$('jiPaymentOrder').value, amount=Number($('jiPaymentAmount').value);
    if(!order_id)return note('Select a vehicle order first.',true); if(!Number.isFinite(amount)||amount<=0)return note('Enter a payment amount greater than zero.',true);
    const {error}=await db().from('cwb_japan_customer_payments').insert({order_id,amount,method:$('jiPaymentMethod').value,reference:$('jiPaymentReference').value.trim()||null});
    if(error)return note('Payment claim failed: '+error.message,true); $('jiPaymentAmount').value='';$('jiPaymentReference').value='';note('Payment claim submitted as PENDING. It is not yet a confirmed payment.',false);await refresh();
  }
  async function confirmPayment(id,reject) {
    if(!isCEO)return note('Only the CEO can confirm or reject customer payments.',true);
    let result;
    if(reject){const reason=(prompt('Reason for rejecting this payment claim (optional):','')||'').trim();result=await db().rpc('cwb_japan_reject_customer_payment',{p_payment_id:id,p_reason:reason||null});}
    else {if(!confirm('Confirm only after checking the real bank/mobile-money/cash transaction. Confirm this customer payment?'))return;result=await db().rpc('cwb_japan_confirm_customer_payment',{p_payment_id:id});}
    if(result.error)return note('Payment action failed: '+result.error.message,true);note(reject?'Payment claim rejected.':'Customer payment confirmed by CEO.',false);await refresh();
  }
  async function commissionReceipt(id,outstanding) {
    if(!isCEO)return note('Only the CEO can confirm commission received.',true);if(outstanding<=0)return note('No outstanding payable commission for this vehicle.',true);
    const raw=prompt('Commission actually received (USD), maximum '+usd(outstanding)+':',String(outstanding));if(raw===null)return;
    const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0||amount>outstanding)return note('Enter an amount greater than zero and no more than the outstanding commission.',true);
    const reference=prompt('Payment/receipt reference (optional):','')||null;
    const {error}=await db().rpc('cwb_japan_record_commission_receipt',{p_order_id:id,p_amount:amount,p_reference:reference});
    if(error)return note('Commission receipt failed: '+error.message,true);note('Commission receipt recorded by CEO.',false);await refresh();
  }
  function options(values,selected,kind,id){return `<select data-${kind}="${esc(id)}">${values.map(v=>`<option ${v===selected?'selected':''}>${esc(v)}</option>`).join('')}</select>`;}
  function renderOrders() {
    const body=$('jiOrderRows');if(!orders.length){body.innerHTML='<tr><td colspan="7">No Japan car imports registered yet.</td></tr>';return;}
    body.innerHTML=orders.map(o=>{const ct=['price','bank_fee','shipping','clearing'].reduce((n,k)=>n+Number(o[k]||0),0);const got=receipts.filter(r=>r.order_id===o.id).reduce((n,r)=>n+Number(r.amount||0),0);const payable=o.dhl_status==='Received in Burundi'?Number(o.commission_final||0):0;const due=Math.max(0,payable-got);
      return `<tr><td><b>${esc(o.order_no)}</b><br>${esc(o.customer)}<br><span class="ji-small">${esc(o.phone||'')}</span></td><td>${esc(o.make)} ${esc(o.year||'')}<br><span class="ji-small">VIN: ${esc(o.vin||'—')}</span></td><td>${usd(ct)} USD</td><td>${options(vehicleStates,o.vehicle_status,'vehicle',o.id)}</td><td>${options(dhlStates,o.dhl_status,'dhl',o.id)}<br><span class="ji-small">${o.dhl_received_at?'Received '+esc(new Date(o.dhl_received_at).toLocaleDateString('fr-FR',{timeZone:'Africa/Bujumbura'})):''}</span></td><td>Final: ${usd(o.commission_final)} USD<br>Received: ${isCEO?usd(got):'CEO only'}<br>Outstanding: ${isCEO?usd(due):'CEO only'}</td><td><button data-discount="${esc(o.id)}">Discount</button>${isCEO?`<button data-receipt="${esc(o.id)}" data-due="${due}">Record commission received</button>`:''}</td></tr>`;
    }).join('');
    body.querySelectorAll('[data-vehicle]').forEach(el=>el.addEventListener('change',()=>updateOrder(el.dataset.vehicle,{vehicle_status:el.value})));
    body.querySelectorAll('[data-dhl]').forEach(el=>el.addEventListener('change',()=>updateOrder(el.dataset.dhl,{dhl_status:el.value,dhl_received_at:el.value==='Received in Burundi'?new Date().toISOString():null})));
    body.querySelectorAll('[data-discount]').forEach(el=>el.addEventListener('click',()=>discount(el.dataset.discount)));
    body.querySelectorAll('[data-receipt]').forEach(el=>el.addEventListener('click',()=>commissionReceipt(el.dataset.receipt,Number(el.dataset.due))));
  }
  function renderPayments() {
    const body=$('jiPaymentRows');if(!payments.length){body.innerHTML='<tr><td colspan="5">No customer payment claims yet.</td></tr>';return;}
    body.innerHTML=payments.map(p=>{const o=orders.find(x=>x.id===p.order_id);return `<tr><td>${esc(o?.order_no||p.order_id)}<br>${esc(o?.customer||'')}</td><td>${usd(p.amount)} USD</td><td>${esc(p.method)}<br>${esc(p.reference||'—')}</td><td><b>${esc(p.status)}</b></td><td>${isCEO&&p.status==='PENDING'?`<button data-confirm="${esc(p.id)}">Confirm</button><button class="secondary" data-reject="${esc(p.id)}">Reject</button>`:(p.status==='CONFIRMED'?'Confirmed':'—')}</td></tr>`;}).join('');
    body.querySelectorAll('[data-confirm]').forEach(el=>el.addEventListener('click',()=>confirmPayment(el.dataset.confirm,false)));body.querySelectorAll('[data-reject]').forEach(el=>el.addEventListener('click',()=>confirmPayment(el.dataset.reject,true)));
  }
  function renderSummary() {
    const earned=orders.reduce((n,o)=>n+Number(o.commission_final||0),0), discounts=orders.reduce((n,o)=>n+Number(o.commission_discount||0),0);
    const payable=orders.reduce((n,o)=>n+(o.dhl_status==='Received in Burundi'?Number(o.commission_final||0):0),0);
    const received=isCEO?receipts.reduce((n,r)=>n+Number(r.amount||0),0):null;
    const outstanding=received===null?null:Math.max(0,payable-received);
    $('jiCommissionSummary').innerHTML=`<div class="ji-stat">Commission after discounts<strong>${usd(earned)} USD</strong></div><div class="ji-stat">Authorized discounts<strong>${usd(discounts)} USD</strong></div><div class="ji-stat">Payable after DHL documents arrive<strong>${usd(payable)} USD</strong></div><div class="ji-stat">Actually received<strong>${received===null?'CEO only':usd(received)+' USD'}</strong></div><div class="ji-stat">Outstanding payable<strong>${outstanding===null?'CEO only':usd(outstanding)+' USD'}</strong></div>`;
  }
  function renderOrderSelect() {const s=$('jiPaymentOrder'), old=s.value;s.innerHTML=orders.map(o=>`<option value="${esc(o.id)}">${esc(o.order_no)} — ${esc(o.customer)} — ${esc(o.make)}</option>`).join('');if(orders.some(o=>o.id===old))s.value=old;}
  async function refresh() {
    try {
      const client=db();if(!client)throw new Error('Supabase client unavailable.');
      let r=await client.from('cwb_japan_import_orders').select('*').order('created_at',{ascending:false});if(r.error)throw r.error;orders=r.data||[];
      r=await client.from('cwb_japan_customer_payments').select('*').order('claimed_at',{ascending:false});if(r.error)throw r.error;payments=r.data||[];
      if(isCEO){r=await client.from('cwb_japan_commission_receipts').select('*').order('received_at',{ascending:false});if(r.error)throw r.error;receipts=r.data||[];}else receipts=[];
      renderOrders();renderPayments();renderSummary();renderOrderSelect();
    } catch(e) {note('Cannot load Japan Car Import: '+(e.message||e)+'. The separate SQL setup must be installed in Supabase.',true);if($('jiOrderRows'))$('jiOrderRows').innerHTML=`<tr><td colspan="7">${esc(e.message||e)}</td></tr>`;}
  }
  async function init() {styles();buildUI();total();try{await checkUser();await refresh();}catch(e){note(e.message||String(e),true);}}
  window.cwbJapanCarImportInit=init;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
