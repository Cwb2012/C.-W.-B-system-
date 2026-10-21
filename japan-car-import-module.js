/* C.W.B JAPAN CAR IMPORT
   English / French
   Requires window.cwbSupabaseClient.
   Uses existing C.W.B Japan Import database tables.
   Private vehicle photo bucket: Japanese_cars
*/
(function () {
  'use strict';

  const BUCKET = 'Japanese_cars';
  const TABLE = 'cwb_japan_import_orders';
  const PAYMENT_TABLE = 'cwb_japan_customer_payments';
  const RECEIPT_TABLE = 'cwb_japan_commission_receipts';
  const COMMISSION = 50;
  const $ = id => document.getElementById(id);
  const db = () => window.cwbSupabaseClient;

  let user = null;
  let isCEO = false;
  let orders = [];
  let payments = [];
  let receipts = [];

  const vehicleStates = [
    'Ordered',
    'Purchased',
    'Shipped',
    'Arrived in Burundi',
    'Delivered'
  ];

  const dhlStates = [
    'Not dispatched',
    'In transit',
    'Received in Burundi'
  ];

  const esc = value => String(value == null ? '' : value).replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char])
  );

  const money = value => Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function localDateTime(value) {
    if (!value) return '';

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Bujumbura',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date(value));
  }

  function say(message, error = false) {
    const el = $('jiMessage');

    if (!el) {
      alert(message);
      return;
    }

    el.textContent = message;
    el.style.color = error ? '#b91c1c' : '#166534';
  }

  function addStyles() {
    if ($('cwbJapanStyle')) return;

    const style = document.createElement('style');
    style.id = 'cwbJapanStyle';

    style.textContent = `
      #japanimport{color:#111827}
      #japanimport .ji-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
        gap:12px
      }
      #japanimport label{
        display:block;font-weight:600;margin:8px 0 4px
      }
      #japanimport input,#japanimport select,#japanimport textarea{
        width:100%;box-sizing:border-box;padding:10px;
        border:1px solid #cbd5e1;border-radius:8px;background:white
      }
      #japanimport textarea{min-height:75px}
      #japanimport button{
        cursor:pointer;border:0;border-radius:8px;padding:10px 13px;
        margin:4px 3px 4px 0;background:#b91c1c;color:white;
        font-weight:600
      }
      #japanimport button.secondary{background:#374151}
      #japanimport button:disabled{opacity:.55;cursor:wait}
      #japanimport .ji-panel{
        border:1px solid #e5e7eb;border-radius:12px;
        padding:14px;margin:14px 0;background:white
      }
      #japanimport .ji-tablewrap{overflow:auto}
      #japanimport table{
        width:100%;border-collapse:collapse;min-width:850px
      }
      #japanimport th,#japanimport td{
        border-bottom:1px solid #e5e7eb;padding:9px;
        text-align:left;vertical-align:top
      }
      #japanimport th{background:#f3f4f6}
      #japanimport .ji-small{font-size:12px;color:#6b7280}
      #japanimport .ji-summary{
        display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));
        gap:9px
      }
      #japanimport .ji-stat{background:#f3f4f6;padding:12px;border-radius:9px}
      #japanimport .ji-stat strong{display:block;font-size:18px;margin-top:5px}
      #japanimport .ji-photo{max-width:110px;max-height:80px;border-radius:6px}
      #japanimport .ji-message{font-weight:600;margin:10px 0}
      @media(max-width:600px){
        #japanimport .ji-panel{padding:10px}
        #japanimport h2{font-size:21px}
      }
    `;

    document.head.appendChild(style);
  }

  function buildUI() {
    const dashboard = document.querySelector('.dashboard');

    if (dashboard && !$('japanimportNav')) {
      const button = document.createElement('button');
      button.id = 'japanimportNav';
      button.className = 'module';
      button.textContent = 'Japan Car Import';
      button.setAttribute('onclick', "showModule('japanimport')");
      dashboard.appendChild(button);
    }

    if ($('japanimport')) return;

    const container = document.querySelector('.container');
    if (!container) return;

    const section = document.createElement('div');
    section.id = 'japanimport';
    section.className = 'card hidden';

    section.innerHTML = `
      <h2>Japan Car Import / Importation de voitures du Japon</h2>
      <p>
        <b>C.W.B System</b> — Better Quality is our priority.
        <br>
        Vehicle orders, customer payments, shipping and commissions.
        <br>
        Dossiers véhicules, paiements clients, transport et commissions.
      </p>

      <div class="ji-panel">
        <h3>1. Register vehicle / Enregistrer un véhicule</h3>

        <div class="ji-grid">
          <div>
            <label>Customer / Client *</label>
            <input id="jiCustomer">
          </div>
          <div>
            <label>Phone / Téléphone</label>
            <input id="jiPhone">
          </div>
          <div>
            <label>Make and model / Marque et modèle *</label>
            <input id="jiMake">
          </div>
          <div>
            <label>Year / Année</label>
            <input id="jiYear" type="number" min="1950" max="2100">
          </div>
          <div>
            <label>VIN / Chassis</label>
            <input id="jiVin">
          </div>
          <div>
            <label>Japan supplier / Fournisseur au Japon</label>
            <input id="jiSupplier">
          </div>
          <div>
            <label>Vehicle price USD / Prix du véhicule</label>
            <input id="jiPrice" type="number" min="0" step=".01" value="0">
          </div>
          <div>
            <label>Bank fee USD / Frais bancaires</label>
            <input id="jiBank" type="number" min="0" step=".01" value="0">
          </div>
          <div>
            <label>Bank fee treatment / Traitement des frais bancaires</label>
            <select id="jiBankTreatment">
              <option value="Customer charged">Charged to customer / À la charge du client</option>
              <option value="CWB absorbed">Paid by C.W.B / À la charge de C.W.B</option>
            </select>
          </div>
          <div>
            <label>Shipping USD / Transport</label>
            <input id="jiShipping" type="number" min="0" step=".01" value="0">
          </div>
          <div>
            <label>Clearing USD / Dédouanement</label>
            <input id="jiClearing" type="number" min="0" step=".01" value="0">
          </div>
          <div>
            <label>Vehicle photo / Photo du véhicule</label>
            <input id="jiPhoto" type="file" accept="image/*">
            <div class="ji-small">
              Private storage: Japanese_cars / Stockage privé
            </div>
          </div>
          <div>
            <label>Notes / Remarques</label>
            <textarea id="jiNotes"></textarea>
          </div>
        </div>

        <p>
          <b>Customer total / Total client:</b>
          <span id="jiCustomerTotal">0.00</span> USD
        </p>
        <p class="ji-small">
          C.W.B commission is tracked separately.
          / La commission C.W.B est suivie séparément.
        </p>

        <button type="button" id="jiSaveOrder">
          Save vehicle / Enregistrer
        </button>
        <button type="button" class="secondary" id="jiRefresh">
          Refresh / Actualiser
        </button>
      </div>

      <div id="jiMessage" class="ji-message" role="status"></div>

      <div class="ji-panel">
        <h3>2. Vehicle register / Registre des véhicules</h3>
        <div class="ji-tablewrap">
          <table>
            <thead>
              <tr>
                <th>Order / Client</th>
                <th>Vehicle / Véhicule</th>
                <th>Photo</th>
                <th>Customer total / Total client</th>
                <th>Vehicle status / Statut</th>
                <th>DHL status / Statut DHL</th>
                <th>Commission</th>
                <th>Documents / Actions</th>
              </tr>
            </thead>
            <tbody id="jiOrderRows">
              <tr><td colspan="8">Loading / Chargement…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="ji-panel">
        <h3>3. Customer payments / Paiements des clients</h3>
        <p class="ji-small">
          Payments stay PENDING until the CEO verifies and confirms the
          real transaction. / Les paiements restent EN ATTENTE jusqu'à
          la vérification et la confirmation par le PDG.
        </p>

        <div class="ji-grid">
          <div>
            <label>Vehicle order / Dossier véhicule</label>
            <select id="jiPaymentOrder"></select>
          </div>
          <div>
            <label>Amount USD / Montant</label>
            <input id="jiPaymentAmount" type="number" min=".01" step=".01">
          </div>
          <div>
            <label>Method / Mode de paiement</label>
            <select id="jiPaymentMethod">
              <option>Bank transfer / Virement bancaire</option>
              <option>Mobile money</option>
              <option>Cash / Espèces</option>
              <option>Other / Autre</option>
            </select>
          </div>
          <div>
            <label>Reference / Référence</label>
            <input id="jiPaymentReference">
          </div>
        </div>

        <button type="button" id="jiSubmitPayment">
          Submit payment claim / Soumettre le paiement
        </button>

        <div class="ji-tablewrap">
          <table>
            <thead>
              <tr>
                <th>Order / Dossier</th>
                <th>Amount / Montant</th>
                <th>Method / Référence</th>
                <th>Status / Statut</th>
                <th>CEO action / Action du PDG</th>
                <th>Receipt / Reçu</th>
              </tr>
            </thead>
            <tbody id="jiPaymentRows"></tbody>
          </table>
        </div>
      </div>

      <div class="ji-panel">
        <h3>4. C.W.B commission / Commission C.W.B</h3>
        <div id="jiCommissionSummary" class="ji-summary"></div>
        <p class="ji-small">
          Standard commission: USD 50 per vehicle.
          Commission becomes payable after DHL documents are received
          in Burundi. Discounts require CEO authorization and a reason.
          Customer payments are separate from C.W.B commission.
          <br>
          Commission standard : 50 USD par véhicule. Elle devient
          exigible après réception des documents DHL au Burundi.
          Toute réduction exige l'autorisation du PDG et un motif.
        </p>
      </div>

      <div class="ji-panel">
        <h3>5. Print documents / Imprimer les documents</h3>
        <div class="ji-grid">
          <div>
            <label>Vehicle order / Dossier véhicule</label>
            <select id="jiDocumentOrder"></select>
          </div>
        </div>
        <button type="button" id="jiPrintQuote">
          Print quotation / Imprimer le devis
        </button>
        <button type="button" id="jiPrintInvoice">
          Print invoice / Imprimer la facture
        </button>
      </div>
    `;

    container.appendChild(section);

    ['jiPrice', 'jiBank', 'jiShipping', 'jiClearing', 'jiBankTreatment']
      .forEach(id => $(id).addEventListener('input', updateTotal));

    $('jiSaveOrder').addEventListener('click', saveOrder);
    $('jiRefresh').addEventListener('click', refresh);
    $('jiSubmitPayment').addEventListener('click', submitPayment);
    $('jiPrintQuote').addEventListener('click', () => printDocument('quote'));
    $('jiPrintInvoice').addEventListener('click', () => printDocument('invoice'));
  }

  function updateTotal() {
    const price = Number($('jiPrice')?.value || 0);
    const bank = $('jiBankTreatment')?.value === 'Customer charged'
      ? Number($('jiBank')?.value || 0)
      : 0;
    const shipping = Number($('jiShipping')?.value || 0);
    const clearing = Number($('jiClearing')?.value || 0);

    if ($('jiCustomerTotal')) {
      $('jiCustomerTotal').textContent = money(price + bank + shipping + clearing);
    }
  }

  async function checkUser() {
    const client = db();
    if (!client) throw new Error('C.W.B Supabase client is not available.');

    const result = await client.auth.getUser();
    if (result.error) throw result.error;
    if (!result.data?.user) throw new Error('Please sign in first. / Veuillez vous connecter.');

    user = result.data.user;

    const profile = await client
      .from('cwb_profiles')
      .select('id,active,role_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profile.error) throw profile.error;
    if (!profile.data || profile.data.active === false) {
      throw new Error('An active C.W.B user profile is required.');
    }

    let roleName = 'User';

    if (profile.data.role_id) {
      const role = await client
        .from('cwb_roles')
        .select('name')
        .eq('id', profile.data.role_id)
        .maybeSingle();

      if (role.error) throw role.error;
      roleName = role.data?.name || 'User';
    }

    isCEO = roleName.trim().toUpperCase() === 'CEO';
  }

  async function uploadPhoto(file, orderId) {
    if (!file) return null;

    if (!file.type || !file.type.startsWith('image/')) {
      throw new Error('Please select an image file. / Choisissez une image.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Image must be 10 MB or smaller. / Image de 10 Mo maximum.');
    }

    const extension = (file.name.split('.').pop() || 'jpg')
      .toLowerCase().replace(/[^a-z0-9]/g, '');

    const path = `${orderId}/${Date.now()}.${extension}`;

    const uploaded = await db().storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploaded.error) throw uploaded.error;

    return path;
  }

  async function signedPhoto(path) {
    if (!path) return '';

    const result = await db().storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    if (result.error) return '';
    return result.data?.signedUrl || '';
  }

  async function saveOrder() {
    const client = db();
    const customer = $('jiCustomer').value.trim();
    const make = $('jiMake').value.trim();

    if (!customer || !make) {
      return say('Customer and vehicle are required. / Le client et le véhicule sont obligatoires.', true);
    }

    const numericIds = ['jiPrice', 'jiBank', 'jiShipping', 'jiClearing'];

    if (numericIds.some(id => !Number.isFinite(Number($(id).value)) || Number($(id).value) < 0)) {
      return say('Costs must be valid non-negative numbers. / Les frais doivent être positifs ou nuls.', true);
    }

    const button = $('jiSaveOrder');
    button.disabled = true;

    try {
      const standard = COMMISSION;

      const row = {
        customer,
        phone: $('jiPhone').value.trim() || null,
        make,
        year: $('jiYear').value ? Number($('jiYear').value) : null,
        vin: $('jiVin').value.trim() || null,
        supplier: $('jiSupplier').value.trim() || null,
        price: Number($('jiPrice').value || 0),
        bank_fee: Number($('jiBank').value || 0),
        shipping: Number($('jiShipping').value || 0),
        clearing: Number($('jiClearing').value || 0),
        notes: [
          $('jiNotes').value.trim(),
          'Bank fee treatment: ' + $('jiBankTreatment').value
        ].filter(Boolean).join('\n'),
        vehicle_status: 'Ordered',
        dhl_status: 'Not dispatched',

        // commission_final is intentionally omitted because
        // the database controls that column.
        commission_standard: standard,
        commission_discount: 0
      };

      const inserted = await client
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

      if (inserted.error) throw inserted.error;

      const order = inserted.data;
      const photo = $('jiPhoto').files?.[0];

      if (photo) {
        try {
          const path = await uploadPhoto(photo, order.id);

          const saved = await client
            .from(TABLE)
            .update({ photo_url: path })
            .eq('id', order.id);

          if (saved.error) throw saved.error;
        } catch (photoError) {
          say(
            'Vehicle saved, but photo upload failed: ' +
            photoError.message +
            '. Check the Japanese_cars bucket policies.',
            true
          );
          await refresh();
          return;
        }
      }

      say('Vehicle registered successfully. / Véhicule enregistré avec succès.');

      [
        'jiCustomer', 'jiPhone', 'jiMake', 'jiYear',
        'jiVin', 'jiSupplier', 'jiNotes'
      ].forEach(id => $(id).value = '');

      numericIds.forEach(id => $(id).value = '0');
      $('jiPhoto').value = '';
      updateTotal();
      await refresh();

    } catch (error) {
      say(
        'Could not save vehicle: ' + (error.message || error) +
        '. Check database permissions and SQL setup.',
        true
      );
    } finally {
      button.disabled = false;
    }
  }

  async function updateOrder(id, fields) {
    const result = await db().from(TABLE).update(fields).eq('id', id);

    if (result.error) {
      say('Update failed: ' + result.error.message, true);
      return;
    }

    say('Updated successfully. / Mise à jour réussie.');
    await refresh();
  }

  async function authorizeDiscount(id) {
    if (!isCEO) {
      return say('Only the CEO can approve commission discounts.', true);
    }

    const raw = prompt('Commission discount in USD (0–50):', '0');
    if (raw === null) return;

    const discount = Number(raw);

    if (!Number.isFinite(discount) || discount < 0 || discount > COMMISSION) {
      return say('Discount must be between 0 and 50 USD.', true);
    }

    let reason = '';

    if (discount > 0) {
      reason = (prompt('Reason for discount / Motif de réduction:') || '').trim();
      if (!reason) return say('A reason is required. / Le motif est obligatoire.', true);
    }

    const result = await db().rpc('cwb_japan_authorize_discount', {
      p_order_id: id,
      p_discount: discount,
      p_reason: reason
    });

    if (result.error) {
      return say('Discount authorization failed: ' + result.error.message, true);
    }

    say('CEO discount approval recorded. / Réduction approuvée par le PDG.');
    await refresh();
  }

  async function recordCommission(id, outstanding) {
    if (!isCEO) {
      return say('Only the CEO can record commission received.', true);
    }

    if (outstanding <= 0) {
      return say('No outstanding commission is payable.', true);
    }

    const raw = prompt(
      'Commission actually received, maximum ' + money(outstanding) + ' USD:',
      String(outstanding)
    );

    if (raw === null) return;

    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) {
      return say('Enter a valid amount not exceeding the outstanding commission.', true);
    }

    const reference = prompt('Receipt/payment reference (optional):', '') || null;

    const result = await db().rpc('cwb_japan_record_commission_receipt', {
      p_order_id: id,
      p_amount: amount,
      p_reference: reference
    });

    if (result.error) {
      return say('Commission receipt failed: ' + result.error.message, true);
    }

    say('Commission receipt recorded. / Reçu de commission enregistré.');
    await refresh();
  }

  async function submitPayment() {
    const orderId = $('jiPaymentOrder').value;
    const amount = Number($('jiPaymentAmount').value);

    if (!orderId) return say('Select a vehicle order first.', true);

    if (!Number.isFinite(amount) || amount <= 0) {
      return say('Enter an amount greater than zero.', true);
    }

    const result = await db().from(PAYMENT_TABLE).insert({
      order_id: orderId,
      amount,
      method: $('jiPaymentMethod').value,
      reference: $('jiPaymentReference').value.trim() || null,
      status: 'PENDING',
      claimed_by: user?.id || null
    });

    if (result.error) {
      return say('Payment claim failed: ' + result.error.message, true);
    }

    $('jiPaymentAmount').value = '';
    $('jiPaymentReference').value = '';
    say('Payment claim submitted. It is PENDING until CEO confirmation.');
    await refresh();
  }

  async function handlePayment(id, reject) {
    if (!isCEO) {
      return say('Only the CEO can confirm or reject payments.', true);
    }

    let result;

    if (reject) {
      const reason = (prompt('Reason for rejection / Motif du rejet:') || '').trim();

      result = await db().rpc('cwb_japan_reject_customer_payment', {
        p_payment_id: id,
        p_reason: reason || null
      });
    } else {
      if (!confirm(
        'Confirm only after checking the actual bank, mobile-money or cash transaction. Continue?'
      )) return;

      result = await db().rpc('cwb_japan_confirm_customer_payment', {
        p_payment_id: id
      });
    }

    if (result.error) {
      return say('Payment action failed: ' + result.error.message, true);
    }

    say(reject
      ? 'Payment claim rejected. / Paiement rejeté.'
      : 'Payment confirmed. / Paiement confirmé.'
    );

    await refresh();
  }

  function selectOptions(values, selected, type, id) {
    return `<select data-${type}="${esc(id)}">${
      values.map(value =>
        `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(value)}</option>`
      ).join('')
    }</select>`;
  }

  async function renderOrders() {
    const body = $('jiOrderRows');

    if (!orders.length) {
      body.innerHTML = '<tr><td colspan="8">No vehicles registered yet. / Aucun véhicule enregistré.</td></tr>';
      return;
    }

    const html = await Promise.all(orders.map(async order => {
      const bankTreatment = (order.notes || '').includes('Bank fee treatment: CWB absorbed')
        ? 'CWB absorbed'
        : 'Customer charged';

      const total =
        Number(order.price || 0) +
        (bankTreatment === 'Customer charged' ? Number(order.bank_fee || 0) : 0) +
        Number(order.shipping || 0) +
        Number(order.clearing || 0);

      const received = receipts
        .filter(receipt => receipt.order_id === order.id)
        .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);

      const payable = order.dhl_status === 'Received in Burundi'
        ? Number(order.commission_final || 0)
        : 0;

      const outstanding = Math.max(0, payable - received);
      const photoUrl = await signedPhoto(order.photo_url);

      return `
        <tr>
          <td>
            <b>${esc(order.order_no || order.id.slice(0, 8))}</b><br>
            ${esc(order.customer)}<br>
            <span class="ji-small">${esc(order.phone || '')}</span>
          </td>
          <td>
            ${esc(order.make)} ${esc(order.year || '')}<br>
            <span class="ji-small">VIN: ${esc(order.vin || '—')}</span>
          </td>
          <td>
            ${photoUrl
              ? `<a href="${esc(photoUrl)}" target="_blank" rel="noopener"><img class="ji-photo" src="${esc(photoUrl)}" alt="Vehicle photo"></a>`
              : '—'}
          </td>
          <td>${money(total)} USD</td>
          <td>${selectOptions(vehicleStates, order.vehicle_status || 'Ordered', 'vehicle', order.id)}</td>
          <td>
            ${selectOptions(dhlStates, order.dhl_status || 'Not dispatched', 'dhl', order.id)}
            <br><span class="ji-small">${
              order.dhl_received_at
                ? 'Received / Reçu: ' + esc(localDateTime(order.dhl_received_at))
                : ''
            }</span>
          </td>
          <td>
            Final / Final: ${money(order.commission_final)} USD<br>
            ${isCEO
              ? `Received / Reçu: ${money(received)}<br>Due / Dû: ${money(outstanding)}`
              : 'Received and due amounts: CEO only'}
          </td>
          <td>
            <button data-discount="${esc(order.id)}">Discount / Réduction</button>
            ${isCEO
              ? `<button data-receipt="${esc(order.id)}" data-due="${outstanding}">Record commission / Enregistrer</button>`
              : ''}
          </td>
        </tr>
      `;
    }));

    body.innerHTML = html.join('');

    body.querySelectorAll('[data-vehicle]').forEach(element => {
      element.addEventListener('change', () => {
        updateOrder(element.dataset.vehicle, {
          vehicle_status: element.value
        });
      });
    });

    body.querySelectorAll('[data-dhl]').forEach(element => {
      element.addEventListener('change', () => {
        const status = element.value;

        updateOrder(element.dataset.dhl, {
          dhl_status: status,
          dhl_received_at: status === 'Received in Burundi'
            ? new Date().toISOString()
            : null
        });
      });
    });

    body.querySelectorAll('[data-discount]').forEach(element => {
      element.addEventListener('click', () => {
        authorizeDiscount(element.dataset.discount);
      });
    });

    body.querySelectorAll('[data-receipt]').forEach(element => {
      element.addEventListener('click', () => {
        recordCommission(
          element.dataset.receipt,
          Number(element.dataset.due)
        );
      });
    });
  }

  function renderPayments() {
    const body = $('jiPaymentRows');

    if (!payments.length) {
      body.innerHTML = '<tr><td colspan="6">No payment claims. / Aucun paiement déclaré.</td></tr>';
      return;
    }

    body.innerHTML = payments.map(payment => {
      const order = orders.find(item => item.id === payment.order_id);
      const status = String(payment.status || 'PENDING').toUpperCase();

      const timestamp = status === 'CONFIRMED'
        ? localDateTime(payment.confirmed_at)
        : status === 'REJECTED'
          ? localDateTime(payment.rejected_at)
          : '';

      return `
        <tr>
          <td>
            ${esc(order?.order_no || payment.order_id)}<br>
            ${esc(order?.customer || '')}
          </td>
          <td>${money(payment.amount)} USD</td>
          <td>
            ${esc(payment.method || '')}<br>
            ${esc(payment.reference || '—')}
          </td>
          <td>
            <b>${esc(status)}</b>
            ${timestamp
              ? `<br><span class="ji-small">${esc(timestamp)} (Burundi)</span>`
              : ''}
          </td>
          <td>
            ${isCEO && status === 'PENDING'
              ? `<button data-confirm="${esc(payment.id)}">Confirm</button>
                 <button class="secondary" data-reject="${esc(payment.id)}">Reject</button>`
              : status === 'CONFIRMED'
                ? 'Confirmed / Confirmé'
                : '—'}
          </td>
          <td>
            ${status === 'CONFIRMED'
              ? `<button data-paymentreceipt="${esc(payment.id)}">Print receipt / Imprimer</button>`
              : 'Available after confirmation / Après confirmation'}
          </td>
        </tr>
      `;
    }).join('');

    body.querySelectorAll('[data-confirm]').forEach(element => {
      element.addEventListener('click', () => {
        handlePayment(element.dataset.confirm, false);
      });
    });

    body.querySelectorAll('[data-reject]').forEach(element => {
      element.addEventListener('click', () => {
        handlePayment(element.dataset.reject, true);
      });
    });

    body.querySelectorAll('[data-paymentreceipt]').forEach(element => {
      element.addEventListener('click', () => {
        printPaymentReceipt(element.dataset.paymentreceipt);
      });
    });
  }

  function renderSummary() {
    const commissionTotal = orders.reduce(
      (sum, order) => sum + Number(order.commission_final || 0), 0
    );

    const discounts = orders.reduce(
      (sum, order) => sum + Number(order.commission_discount || 0), 0
    );

    const payable = orders.reduce(
      (sum, order) => sum + (
        order.dhl_status === 'Received in Burundi'
          ? Number(order.commission_final || 0)
          : 0
      ),
      0
    );

    const received = isCEO
      ? receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0)
      : null;

    const outstanding = received === null
      ? null
      : Math.max(0, payable - received);

    $('jiCommissionSummary').innerHTML = `
      <div class="ji-stat">Commission after discounts<strong>${money(commissionTotal)} USD</strong></div>
      <div class="ji-stat">Discounts / Réductions<strong>${money(discounts)} USD</strong></div>
      <div class="ji-stat">Payable after DHL / Dû après DHL<strong>${money(payable)} USD</strong></div>
      <div class="ji-stat">Actually received / Reçu<strong>${received === null ? 'CEO only' : money(received) + ' USD'}</strong></div>
      <div class="ji-stat">Outstanding / Solde dû<strong>${outstanding === null ? 'CEO only' : money(outstanding) + ' USD'}</strong></div>
    `;
  }

  function renderOrderSelects() {
    const markup = orders.map(order =>
      `<option value="${esc(order.id)}">${esc(order.order_no || order.id.slice(0, 8))} — ${esc(order.customer)} — ${esc(order.make)}</option>`
    ).join('');

    ['jiPaymentOrder', 'jiDocumentOrder'].forEach(id => {
      const select = $(id);
      const previous = select.value;

      select.innerHTML = markup;

      if (orders.some(order => order.id === previous)) {
        select.value = previous;
      }
    });
  }

  async function refresh() {
    try {
      const client = db();

      let result = await client
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;
      orders = result.data || [];

      result = await client
        .from(PAYMENT_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;
      payments = result.data || [];

      if (isCEO) {
        result = await client
          .from(RECEIPT_TABLE)
          .select('*')
          .order('received_at', { ascending: false });

        if (result.error) throw result.error;
        receipts = result.data || [];
      } else {
        receipts = [];
      }

      await renderOrders();
      renderPayments();
      renderSummary();
      renderOrderSelects();

    } catch (error) {
      say(
        'Cannot load Japan Car Import: ' + (error.message || error) +
        '. Check the SQL setup and database permissions.',
        true
      );
    }
  }

  function selectedOrder() {
    const id = $('jiDocumentOrder')?.value;
    return orders.find(order => order.id === id);
  }

  function documentHtml(order, type) {
    const bankTreatment = (order.notes || '').includes('Bank fee treatment: CWB absorbed')
      ? 'CWB absorbed'
      : 'Customer charged';

    const price = Number(order.price || 0);
    const bank = bankTreatment === 'Customer charged'
      ? Number(order.bank_fee || 0)
      : 0;
    const shipping = Number(order.shipping || 0);
    const clearing = Number(order.clearing || 0);
    const total = price + bank + shipping + clearing;

    const title = type === 'quote'
      ? 'QUOTATION / DEVIS'
      : 'INVOICE / FACTURE';

    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Bujumbura',
      dateStyle: 'long'
    }).format(new Date());

    return `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#111827;margin:30px}
          h1,h2{color:#991b1b}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th,td{border:1px solid #d1d5db;padding:10px;text-align:left}
          th{background:#f3f4f6}
          .right{text-align:right}
          .small{font-size:12px;color:#555}
          .total{font-size:18px;font-weight:bold}
          @media print{button{display:none}body{margin:10mm}}
        </style>
      </head>
      <body>
        <h1>C.W.B System</h1>
        <h2>Camel Work and Business Company</h2>
        <p><b>Better Quality is our priority</b></p>
        <p>
          Bujumbura, Chaussée du Peuple Murundi No. 54<br>
          Phone: 67481564 / 62180032<br>
          NIF: 4002652933<br>
          RC: 0056983/24
        </p>
        <hr>
        <h2>${title}</h2>
        <p><b>Document / Document :</b> ${esc(order.order_no || order.id)}</p>
        <p><b>Date / Date :</b> ${esc(date)}</p>
        <p><b>Customer / Client :</b> ${esc(order.customer)}</p>
        <p><b>Phone / Téléphone :</b> ${esc(order.phone || '—')}</p>
        <p><b>Vehicle / Véhicule :</b> ${esc(order.make)} ${esc(order.year || '')}</p>
        <p><b>VIN / Chassis :</b> ${esc(order.vin || '—')}</p>

        <table>
          <thead>
            <tr><th>Description / Désignation</th><th class="right">Amount / Montant (USD)</th></tr>
          </thead>
          <tbody>
            <tr><td>Vehicle price / Prix du véhicule</td><td class="right">${money(price)}</td></tr>
            <tr><td>Bank fee / Frais bancaires</td><td class="right">${money(bank)}</td></tr>
            <tr><td>Shipping / Transport</td><td class="right">${money(shipping)}</td></tr>
            <tr><td>Clearing / Dédouanement</td><td class="right">${money(clearing)}</td></tr>
            <tr><td class="total">Customer total / Total client</td><td class="right total">${money(total)}</td></tr>
          </tbody>
        </table>

        <p>
          C.W.B commission / Commission C.W.B:
          ${money(order.commission_final)} USD.
          This commission is tracked separately and is not included in
          the customer total above.
        </p>
        <p>
          La commission C.W.B est suivie séparément et n'est pas incluse
          dans le total client ci-dessus.
        </p>
        <p><b>Notes / Remarques:</b><br>${esc(order.notes || '—').replace(/\n/g, '<br>')}</p>
        <p class="small">
          This document records the listed costs. Actual payments must be
          verified and confirmed in the C.W.B System.
          / Ce document présente les frais indiqués. Les paiements réels
          doivent être vérifiés et confirmés dans le système C.W.B.
        </p>
        <p>Customer signature / Signature du client: __________________</p>
        <p>C.W.B signature / Signature C.W.B: __________________</p>
        <button onclick="window.print()">Print / Imprimer</button>
      </body>
      </html>
    `;
  }

  function printDocument(type) {
    const order = selectedOrder();

    if (!order) return say('Select a vehicle order first.', true);

    const win = window.open('', '_blank');

    if (!win) return say('Allow pop-ups to print the document.', true);

    win.document.open();
    win.document.write(documentHtml(order, type));
    win.document.close();
  }

  function printPaymentReceipt(paymentId) {
    const payment = payments.find(item => item.id === paymentId);

    if (!payment || String(payment.status).toUpperCase() !== 'CONFIRMED') {
      return say('Only confirmed payments can have a receipt.', true);
    }

    const order = orders.find(item => item.id === payment.order_id);
    const confirmedTime = localDateTime(payment.confirmed_at);
    const win = window.open('', '_blank');

    if (!win) return say('Allow pop-ups to print the receipt.', true);

    win.document.open();

    win.document.write(`
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>C.W.B Payment Receipt / Reçu de paiement</title>
        <style>
          body{font-family:Arial,sans-serif;margin:30px;color:#111827}
          h1,h2{color:#991b1b}
          .box{border:1px solid #bbb;padding:18px;margin-top:20px}
          @media print{button{display:none}}
        </style>
      </head>
      <body>
        <h1>C.W.B System</h1>
        <h2>Camel Work and Business Company</h2>
        <p>Better Quality is our priority</p>
        <p>Bujumbura, Chaussée du Peuple Murundi No. 54</p>
        <p>Phone: 67481564 / 62180032 | NIF: 4002652933 | RC: 0056983/24</p>
        <hr>
        <h2>PAYMENT RECEIPT / REÇU DE PAIEMENT</h2>
        <div class="box">
          <p><b>Receipt reference / Référence:</b> ${esc(payment.reference || payment.id)}</p>
          <p><b>Customer / Client:</b> ${esc(order?.customer || '')}</p>
          <p><b>Vehicle / Véhicule:</b> ${esc(order?.make || '')} ${esc(order?.year || '')}</p>
          <p><b>Amount received / Montant reçu:</b> ${money(payment.amount)} USD</p>
          <p><b>Method / Mode:</b> ${esc(payment.method || '')}</p>
          <p><b>Confirmed date and time / Date et heure de confirmation:</b>
            ${esc(confirmedTime)} (Burundi / Burundi)
          </p>
          <p><b>Status / Statut:</b> CONFIRMED / CONFIRMÉ</p>
        </div>
        <p>
          This receipt is issued for a payment confirmed by C.W.B.
          / Ce reçu est délivré pour un paiement confirmé par C.W.B.
        </p>
        <p>Authorized signature / Signature autorisée: __________________</p>
        <button onclick="window.print()">Print / Imprimer</button>
      </body>
      </html>
    `);

    win.document.close();
  }

  async function init() {
    addStyles();
    buildUI();
    updateTotal();

    try {
      await checkUser();
      await refresh();
    } catch (error) {
      say(error.message || String(error), true);
    }
  }

  window.cwbJapanCarImportInit = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
