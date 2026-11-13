/* C.W.B System — China & Dubai Import (normalized Supabase module)
 * Uses cwb_cd_* tables only. Does not read, alter, migrate or delete legacy imports.
 * Receipt is performed by public.cwb_cd_confirm_item_receipt(uuid).
 */
(function () {
  'use strict';
  const TABLES = {
    shipments: 'cwb_cd_shipments', suppliers: 'cwb_cd_import_suppliers',
    items: 'cwb_cd_import_items', costs: 'cwb_cd_import_company_costs',
    docs: 'cwb_cd_shipment_documents'
  };
  const BUCKET = 'cwb-china-dubai-customs';
  const $ = id => document.getElementById(id);
  const db = () => window.cwbSupabaseClient || window.supabaseClient || null;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val = id => $(id) ? $(id).value.trim() : '';
  const nval = id => Math.max(0, Number(val(id)) || 0);
  const money = n => Number(n || 0).toLocaleString('fr-FR',{maximumFractionDigits:2});
  let suppliers = [], items = [], costs = [], currentShipment = null;
  let initialized = false;

  function message(text, bad) {
    const el = $('cdiMessage'); if (!el) return;
    el.textContent = text; el.style.color = bad ? '#b91c1c' : '#166534';
  }
  function requireClient() {
    const c = db(); if (!c) throw new Error('Connexion Supabase introuvable. Vérifie le client Supabase dans index.html.');
    return c;
  }
  function addSupplier(data) {
    suppliers.push(data || {supplier_name:'',contact_details:'',invoice_reference:'',currency:'USD',notes:''});
    renderSuppliers(); renderSupplierOptions();
  }
  function renderSuppliers() {
    const host = $('cdiSuppliers'); if (!host) return;
    host.innerHTML = suppliers.map((s,i)=>`<div class="cdi-card" data-supplier="${i}">
      <div class="cdi-grid"><label>Nom fournisseur<input data-k="supplier_name" value="${esc(s.supplier_name)}" placeholder="Nom du fournisseur" required></label>
      <label>Contact<input data-k="contact_details" value="${esc(s.contact_details)}"></label>
      <label>Référence facture<input data-k="invoice_reference" value="${esc(s.invoice_reference)}"></label>
      <label>Devise<select data-k="currency"><option ${s.currency==='USD'?'selected':''}>USD</option><option ${s.currency==='RMB'?'selected':''}>RMB</option><option ${s.currency==='BIF'?'selected':''}>BIF</option></select></label>
      <label>Notes<input data-k="notes" value="${esc(s.notes)}"></label></div>
      <button type="button" data-remove-supplier="${i}" class="cdi-danger">Retirer fournisseur</button></div>`).join('');
    host.querySelectorAll('[data-k]').forEach(el=>el.addEventListener('input',()=>{const i=Number(el.closest('[data-supplier]').dataset.supplier);suppliers[i][el.dataset.k]=el.value;renderSupplierOptions();}));
    host.querySelectorAll('[data-remove-supplier]').forEach(b=>b.addEventListener('click',()=>{suppliers.splice(Number(b.dataset.removeSupplier),1);renderSuppliers();renderSupplierOptions();}));
  }
  function renderSupplierOptions() {
    document.querySelectorAll('.cdi-item-supplier').forEach(sel=>{
      const old=sel.value; sel.innerHTML='<option value="">Choisir fournisseur</option>'+suppliers.map((s,i)=>`<option value="${i}">${esc(s.supplier_name||'Fournisseur '+(i+1))}</option>`).join('');
      if (old!=='' && suppliers[Number(old)]) sel.value=old;
    });
  }
  function addItem(data) {
    items.push(data || {supplierIndex:'',item_name:'',category:'',unit:'pieces',carton_quantity:1,pieces_per_carton:1,total_quantity:1,purchase_currency:'USD',purchase_unit_price:0,exchange_rate_to_bif:1,transport_cost_bif:0,customs_cost_bif:0,other_costs_bif:0,wholesale_price_bif:0,retail_price_bif:0,notes:''});
    renderItems();
  }
  function renderItems() {
    const host=$('cdiItems'); if(!host)return;
    host.innerHTML=items.map((it,i)=>`<div class="cdi-card" data-item="${i}"><h4>Marchandise ${i+1}</h4><div class="cdi-grid">
      <label>Fournisseur<select class="cdi-item-supplier"><option value="">Choisir fournisseur</option></select></label>
      ${field('item_name','Nom marchandise',it.item_name,'text')}${field('category','Catégorie',it.category,'text')}
      <label>Unité<select data-k="unit"><option value="pieces">Pièces</option><option value="litres">Litres</option><option value="rolls">Rouleaux</option><option value="boxes">Boîtes</option><option value="kg">Kg</option><option value="sets">Sets</option><option value="other">Autre</option></select></label>
      ${field('carton_quantity','Nombre cartons',it.carton_quantity,'number')}${field('pieces_per_carton','Unités/carton',it.pieces_per_carton,'number')}${field('total_quantity','Quantité totale',it.total_quantity,'number')}
      <label>Devise achat<select data-k="purchase_currency"><option>USD</option><option>RMB</option><option>BIF</option></select></label>
      ${field('purchase_unit_price','Prix achat / unité',it.purchase_unit_price,'number')}${field('exchange_rate_to_bif','Taux vers BIF',it.exchange_rate_to_bif,'number')}
      ${field('transport_cost_bif','Transport affecté (BIF)',it.transport_cost_bif,'number')}${field('customs_cost_bif','Douane affectée (BIF)',it.customs_cost_bif,'number')}${field('other_costs_bif','Autres frais (BIF)',it.other_costs_bif,'number')}
      ${field('wholesale_price_bif','Prix gros (BIF)',it.wholesale_price_bif,'number')}${field('retail_price_bif','Prix détail (BIF)',it.retail_price_bif,'number')}${field('notes','Notes',it.notes,'text')}</div>
      <button type="button" class="cdi-danger" data-remove-item="${i}">Retirer marchandise</button></div>`).join('');
    host.querySelectorAll('[data-k]').forEach(el=>{const i=Number(el.closest('[data-item]').dataset.item);el.value=items[i][el.dataset.k]??'';el.addEventListener('input',()=>items[i][el.dataset.k]=el.value);});
    host.querySelectorAll('[data-item] .cdi-item-supplier').forEach(sel=>{const i=Number(sel.closest('[data-item]').dataset.item);renderSupplierOptions();sel.value=items[i].supplierIndex??'';sel.addEventListener('change',()=>items[i].supplierIndex=sel.value);});
    host.querySelectorAll('[data-remove-item]').forEach(b=>b.addEventListener('click',()=>{items.splice(Number(b.dataset.removeItem),1);renderItems();}));
  }
  function field(k,label,v,type){return `<label>${label}<input data-k="${k}" type="${type}" ${type==='number'?'min="0" step="0.01"':''} value="${esc(v)}"></label>`;}
  function addCost(data){costs.push(data||{company_name:'',service_description:'',invoice_reference:'',currency:'BIF',amount:0,exchange_rate_to_bif:1,notes:''});renderCosts();}
  function renderCosts(){const h=$('cdiCosts');if(!h)return;h.innerHTML=costs.map((c,i)=>`<div class="cdi-card" data-cost="${i}"><div class="cdi-grid">${field('company_name','Prestataire / société',c.company_name,'text')}${field('service_description','Description frais',c.service_description,'text')}${field('invoice_reference','Référence facture',c.invoice_reference,'text')}<label>Devise<select data-k="currency"><option>BIF</option><option>USD</option><option>RMB</option></select></label>${field('amount','Montant',c.amount,'number')}${field('exchange_rate_to_bif','Taux vers BIF',c.exchange_rate_to_bif,'number')}${field('notes','Notes',c.notes,'text')}</div><button type="button" class="cdi-danger" data-remove-cost="${i}">Retirer frais</button></div>`).join('');h.querySelectorAll('[data-k]').forEach(el=>{const i=Number(el.closest('[data-cost]').dataset.cost);el.value=costs[i][el.dataset.k]??'';el.addEventListener('input',()=>costs[i][el.dataset.k]=el.value);});h.querySelectorAll('[data-remove-cost]').forEach(b=>b.addEventListener('click',()=>{costs.splice(Number(b.dataset.removeCost),1);renderCosts();}));}
     function buildUI() {
    if($('chinaDubaiImport')) return;
    const parent=document.querySelector('.container')||document.querySelector('main')||document.body;
    const section=document.createElement('section');section.id='chinaDubaiImport';section.className='card hidden';
    section.innerHTML=`<h2>C.W.B China &amp; Dubai Import</h2><p>Camel Work and Business company — Better Quality is our priority</p>
    <div id="cdiMessage" role="status"></div>
    <div class="cdi-card"><h3>1. Dossier d'expédition</h3><div class="cdi-grid">
    <label>Pays / origine<select id="cdiCountry"><option>China</option><option>Dubai</option><option>China &amp; Dubai</option></select></label>
    <label>Date expédition<input id="cdiDate" type="date"></label><label>Référence expédition<input id="cdiReference"></label>
    <label>Taux USD vers BIF<input id="cdiUsdRate" type="number" min="0" step="0.01" value="1"></label><label>Taux RMB vers BIF<input id="cdiRmbRate" type="number" min="0" step="0.01" value="1"></label>
    <label>Frais documentaires (USD)<input id="cdiDocFee" type="number" min="0" step="0.01" value="0"></label><label>Notes<textarea id="cdiNotes"></textarea></label></div></div>
    <div class="cdi-card"><h3>2. Fournisseurs et factures</h3><div id="cdiSuppliers"></div><button type="button" id="cdiAddSupplier">+ Ajouter fournisseur</button></div>
    <div class="cdi-card"><h3>3. Marchandises</h3><div id="cdiItems"></div><button type="button" id="cdiAddItem">+ Ajouter marchandise</button></div>
    <div class="cdi-card"><h3>4. Frais communs</h3><div id="cdiCosts"></div><button type="button" id="cdiAddCost">+ Ajouter frais</button></div>
    <div class="cdi-card"><button type="button" id="cdiSave">Enregistrer le dossier</button><button type="button" id="cdiPrint">Imprimer dossier</button></div>
    <div class="cdi-card"><h3>5. Recherche dossier</h3><div class="cdi-grid"><label>Numéro dossier<input id="cdiSearchNumber" placeholder="CDI-2026-00001"></label><button type="button" id="cdiSearch">Rechercher</button></div><div id="cdiFound"></div></div>
    
<div class="cdi-card">
<h3>6. Documents et factures</h3>
<label>Document PDF / image
<input id="cdiDocument" type="file" accept=".pdf,image/jpeg,image/png,image/webp">
</label>
<label>Fournisseur associé
<select id="cdiDocumentSupplier">
<option value="">Document général du dossier</option>
</select>
</label>
<button type="button" id="cdiUpload">Téléverser document</button>
<div id="cdiDocuments"></div>
</div>

<div class="cdi-card">
<h3>7. 📸 Photos des marchandises</h3>
<p>Ajoute les photos des produits de cette expédition.</p>

<label>Prendre une photo ou choisir dans la galerie
<input id="cdiPhotos" type="file"
accept="image/*" capture="environment" multiple>
</label>

<button type="button" id="cdiUploadPhotos">
📸 Enregistrer les photos
</button>

<div id="cdiPhotoGallery">
Aucune photo chargée.
</div>
</div>

    const style=document.createElement('style');style.textContent=`#chinaDubaiImport{color:#172033}#chinaDubaiImport .cdi-card{background:#fff;border:1px solid #dbe1ea;border-radius:12px;padding:14px;margin:12px 0}#chinaDubaiImport .cdi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}#chinaDubaiImport label{display:block;font-weight:600}#chinaDubaiImport input,#chinaDubaiImport select,#chinaDubaiImport textarea{display:block;width:100%;box-sizing:border-box;padding:9px;margin:5px 0 10px;border:1px solid #cbd5e1;border-radius:7px}#chinaDubaiImport button{background:#b91c1c;color:white;border:0;border-radius:8px;padding:10px 14px;margin:5px;cursor:pointer}#chinaDubaiImport .cdi-danger{background:#64748b}#cdiMessage{font-weight:600;margin:10px 0}@media print{body *{visibility:hidden}#chinaDubaiImport,#chinaDubaiImport *{visibility:visible}#chinaDubaiImport{position:absolute;left:0;top:0;width:100%}#chinaDubaiImport button,#chinaDubaiImport input[type=file]{display:none}}`;
    document.head.appendChild(style);parent.appendChild(section);
$('cdiAddSupplier').onclick=()=>addSupplier();$('cdiAddItem').onclick=()=>addItem();$('cdiAddCost').onclick=()=>addCost();$('cdiSave').onclick=saveShipment;$('cdiPrint').onclick=()=>window.print();$('cdiSearch').onclick=searchShipment;$('cdiUpload').onclick=uploadDocument;$('cdiUploadPhotos').onclick=uploadPhotos;

    addSupplier();addItem();
  }
     async function saveShipment(){
    const c=requireClient();if(!suppliers.length||!items.length)throwMessage('Ajoute au moins un fournisseur et une marchandise.');
    if(suppliers.some(s=>!String(s.supplier_name||'').trim()))throwMessage('Chaque fournisseur doit avoir un nom.');
    if(items.some(i=>!String(i.item_name||'').trim()||!(Number(i.total_quantity)>0)))throwMessage('Chaque marchandise doit avoir un nom et une quantité totale positive.');
    try{
      message('Enregistrement en cours…');
      const {data:userData}=await c.auth.getUser();const user=userData&&userData.user;if(!user)throw new Error('Connecte-toi à C.W.B System.');
      const shipmentPayload={created_by:user.id,source_country:val('cdiCountry'),shipment_date:val('cdiDate')||null,shipment_reference:val('cdiReference')||null,status:'Draft',notes:val('cdiNotes')||null,usd_to_bif_rate:nval('cdiUsdRate'),rmb_to_usd_rate:nval('cdiRmbRate'),document_fee_usd:nval('cdiDocFee'),transport_rate_usd_per_cbm:0};
      const sh=await c.from(TABLES.shipments).insert(shipmentPayload).select('*').single();if(sh.error)throw sh.error;currentShipment=sh.data;
      const supplierRows=suppliers.map(s=>({shipment_id:currentShipment.id,supplier_name:s.supplier_name,contact_details:s.contact_details||null,invoice_reference:s.invoice_reference||null,currency:s.currency||'USD',notes:s.notes||null}));
      const sr=await c.from(TABLES.suppliers).insert(supplierRows).select('*');if(sr.error)throw sr.error;
      const totalPurchase=items.reduce((sum,i)=>sum+(Number(i.total_quantity)||0)*(Number(i.purchase_unit_price)||0)*(Number(i.exchange_rate_to_bif)||0),0);
      const commonBif=costs.reduce((sum,x)=>sum+(Number(x.amount)||0)*(Number(x.exchange_rate_to_bif)||0),0);
      const itemRows=items.map(i=>{const purchase=Number(i.total_quantity)*Number(i.purchase_unit_price)*Number(i.exchange_rate_to_bif);const share=totalPurchase>0?commonBif*purchase/totalPurchase:commonBif/items.length;const landed=purchase+(Number(i.transport_cost_bif)||0)+(Number(i.customs_cost_bif)||0)+(Number(i.other_costs_bif)||0)+share;return {shipment_id:currentShipment.id,supplier_id:sr.data[Number(i.supplierIndex)]?.id||null,item_name:i.item_name,category:i.category||null,unit:i.unit,total_quantity:Number(i.total_quantity),carton_quantity:Number(i.carton_quantity)||0,pieces_per_carton:Number(i.pieces_per_carton)||0,purchase_currency:i.purchase_currency,purchase_unit_price:Number(i.purchase_unit_price)||0,exchange_rate_to_bif:Number(i.exchange_rate_to_bif)||0,purchase_cost_bif:purchase,transport_cost_bif:(Number(i.transport_cost_bif)||0)+share,customs_cost_bif:Number(i.customs_cost_bif)||0,other_costs_bif:Number(i.other_costs_bif)||0,landed_cost_bif:landed,wholesale_price_bif:Number(i.wholesale_price_bif)||0,retail_price_bif:Number(i.retail_price_bif)||0,status:'Draft',notes:i.notes||null};});
      const ir=await c.from(TABLES.items).insert(itemRows);if(ir.error)throw ir.error;
      if(costs.length){const costRows=costs.map(x=>({shipment_id:currentShipment.id,company_name:x.company_name||null,service_description:x.service_description||null,invoice_reference:x.invoice_reference||null,currency:x.currency,amount:Number(x.amount)||0,exchange_rate_to_bif:Number(x.exchange_rate_to_bif)||0,amount_bif:(Number(x.amount)||0)*(Number(x.exchange_rate_to_bif)||0),notes:x.notes||null}));const cr=await c.from(TABLES.costs).insert(costRows);if(cr.error)throw cr.error;}
      $('cdiSearchNumber').value=currentShipment.shipment_number;message('Dossier enregistré : '+currentShipment.shipment_number);await loadShipment(currentShipment.id);
    }catch(e){message('Erreur : '+(e.message||e.details||String(e))+' — Vérifie le dossier avant de réessayer, car une sauvegarde partielle peut exister.',true);}
  }
  function throwMessage(t){message(t,true);throw new Error(t);}
  async function searchShipment(){try{const c=requireClient();const q=val('cdiSearchNumber');if(!q)return message('Saisis un numéro de dossier.',true);const r=await c.from(TABLES.shipments).select('id,shipment_number').eq('shipment_number',q).maybeSingle();if(r.error)throw r.error;if(!r.data)return message('Dossier introuvable.',true);await loadShipment(r.data.id);}catch(e){message('Recherche impossible : '+e.message,true);}}
  async function loadShipment(id){const c=requireClient();const [sh,su,it,co,doq]=await Promise.all([c.from(TABLES.shipments).select('*').eq('id',id).single(),c.from(TABLES.suppliers).select('*').eq('shipment_id',id),c.from(TABLES.items).select('*').eq('shipment_id',id),c.from(TABLES.costs).select('*').eq('shipment_id',id),c.from(TABLES.docs).select('*').eq('shipment_id',id)]);for(const x of [sh,su,it,co,doq])if(x.error)throw x.error;currentShipment=sh.data;$('cdiFound').innerHTML=`<h4>${esc(sh.data.shipment_number)} — ${esc(sh.data.status)}</h4><p>Origine : ${esc(sh.data.source_country)} | Date : ${esc(sh.data.shipment_date||'')}</p>`+it.data.map(row=>`<div class="cdi-card"><b>${esc(row.item_name)}</b> — ${esc(row.total_quantity)} ${esc(row.unit)} — Coût rendu : ${money(row.landed_cost_bif)} BIF — Statut : ${esc(row.status)}<br>${row.status==='Draft'?`<button type="button" data-arrive="${row.id}">Marquer Arrivé</button>`:''}${row.status==='Arrived'?`<button type="button" data-receive="${row.id}">Confirmer réception → Inventory</button>`:''}</div>`).join('');$('cdiFound').querySelectorAll('[data-arrive]').forEach(b=>b.onclick=()=>setArrived(b.dataset.arrive));$('cdiFound').querySelectorAll('[data-receive]').forEach(b=>b.onclick=()=>receiveItem(b.dataset.receive));$('cdiDocuments').innerHTML=doq.data.map(d=>`<p>${esc(d.original_name)} — ${esc(d.document_type)}</p>`).join('')||'Aucun document.';$('cdiDocumentSupplier').innerHTML='<option value="">Document général du dossier</option>'+su.data.map(s=>`<option value="${s.id}">${esc(s.supplier_name)}</option>`).join('');message('Dossier chargé : '+sh.data.shipment_number);}
  async function setArrived(id){try{const c=requireClient();const r=await c.from(TABLES.items).update({status:'Arrived',updated_at:new Date().toISOString()}).eq('id',id).eq('status','Draft');if(r.error)throw r.error;await loadShipment(currentShipment.id);}catch(e){message('Impossible de changer le statut : '+e.message,true);}}
  async function receiveItem(id){if(!confirm('Confirmer la réception ? Cette action ajoutera la quantité à Inventory.'))return;try{const c=requireClient();const r=await c.rpc('cwb_cd_confirm_item_receipt',{p_item_id:id});if(r.error)throw r.error;message('Réception confirmée. Résultat : '+JSON.stringify(r.data));await loadShipment(currentShipment.id);}catch(e){message('Réception non confirmée : '+e.message,true);}}
  async function uploadDocument(){try{const c=requireClient();if(!currentShipment)throw new Error('Recherche ou enregistre d’abord un dossier.');const file=$('cdiDocument').files[0];if(!file)throw new Error('Choisis un document.');if(file.size>20*1024*1024)throw new Error('Fichier supérieur à 20 MB.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=currentShipment.id+'/'+Date.now()+'_'+safe;const up=await c.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(up.error)throw up.error;const userData=await c.auth.getUser();const row=await c.from(TABLES.docs).insert({shipment_id:currentShipment.id,supplier_id:val('cdiDocumentSupplier')||null,document_type:file.type==='application/pdf'?'PDF':'Image',document_path:path,original_name:file.name,uploaded_by:userData.data.user.id});if(row.error)throw row.error;message('Document archivé.');await loadShipment(currentShipment.id);}catch(e){message('Téléversement impossible : '+e.message,true);}}

async function uploadPhotos(){
  try {
    const c = requireClient();

    if(!currentShipment)
      throw new Error('Recherche ou enregistre d’abord un dossier.');

    const input = $('cdiPhotos');
    const files = Array.from(input.files || []);

    if(!files.length)
      throw new Error('Choisis au moins une photo.');

    for(const file of files){
      if(!file.type.startsWith('image/'))
        throw new Error('Seules les images sont acceptées.');

      if(file.size > 20*1024*1024)
        throw new Error('Une photo dépasse 20 MB.');
    }

    const auth = await c.auth.getUser();
    const user = auth.data && auth.data.user;

    if(!user)
      throw new Error('Connecte-toi à C.W.B System.');

    message('Enregistrement des photos en cours…');

    let uploaded = 0;

    for(const file of files){
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');

      const path =
        currentShipment.id +
        '/photos/' +
        Date.now() + '_' +
        Math.random().toString(36).slice(2,8) +
        '_' + safe;

      const up = await c.storage
        .from(BUCKET)
        .upload(path,file,{
          upsert:false,
          contentType:file.type
        });

      if(up.error) throw up.error;

      const row = await c.from(TABLES.docs).insert({
        shipment_id:currentShipment.id,
        supplier_id:null,
        document_type:'Photo marchandise',
        document_path:path,
        original_name:file.name,
        uploaded_by:user.id
      });

      if(row.error) throw row.error;

      uploaded++;
    }

    input.value = '';

    message(uploaded + ' photo(s) enregistrée(s) avec succès.');

    await loadShipment(currentShipment.id);

  } catch(e) {
    message('Erreur photos : '+e.message,true);
  }
}

  function initialize(){if(initialized)return;buildUI();initialized=true;}
  window.cwbInitChinaDubaiImport=initialize;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
