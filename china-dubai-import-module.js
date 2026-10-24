
/* C.W.B China & Dubai Import Module
   Achat par unité ou carton, photos et frais d'importation.
   Pas de conversion automatique, prix de vente ou bénéfice.
   Sauvegarde Supabase et intégration inventaire à faire séparément.
*/
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  let itemNo = 0;

  const fmt = value => Number(value || 0).toLocaleString('fr-FR', {
    maximumFractionDigits: 3
  });

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[c]));

  function addProduct() {
    const body = $('cdiProducts');
    if (!body) return;

    const row = document.createElement('tr');
    row.dataset.id = String(++itemNo);
    row.dataset.photo = '';

    row.innerHTML = `
      <td><input class="cdi-name" placeholder="Nom de marchandise"
        aria-label="Nom de marchandise" required></td>

      <td><select class="cdi-unit" aria-label="Unité">
        <option value="litres">Litres</option>
        <option value="pieces">Pièces</option>
        <option value="rolls">Rouleaux</option>
        <option value="cartons">Cartons</option>
        <option value="kg">Kg</option>
        <option value="sets">Sets</option>
        <option value="other">Autre</option>
      </select></td>

      <td><label>Unités par carton</label>
        <input class="cdi-percarton" type="number" min="0.001"
          step="0.001" value="12" aria-label="Unités par carton"></td>

      <td><label>Nombre de cartons</label>
        <input class="cdi-cartons" type="number" min="0"
          step="1" value="0" aria-label="Nombre de cartons"></td>

      <td><label>Mode de prix d'achat</label>
        <select class="cdi-pricebasis" aria-label="Mode de prix d'achat">
          <option value="carton">Prix par carton</option>
          <option value="unit">Prix par unité</option>
        </select></td>

      <td><label>Monnaie d'achat</label>
        <select class="cdi-currency" aria-label="Monnaie d'achat">
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
          <option value="BIF">FB/BIF</option>
          <option value="OTHER">Autre monnaie</option>
        </select></td>

      <td><label>Prix d'achat saisi</label>
        <input class="cdi-price" type="number" min="0"
          step="0.001" value="0" aria-label="Prix d'achat"></td>

      <td><strong>Quantité totale</strong>
        <div class="cdi-quantity">0</div></td>

      <td><strong>Total achat</strong>
        <div class="cdi-purchase">0</div></td>

      <td><label>Photo obligatoire</label>
        <input class="cdi-photo" type="file" accept="image/*"
          capture="environment" aria-label="Photo de la marchandise" required>
        <img class="cdi-preview" alt="Aperçu de la marchandise"
          style="display:none;max-width:100px;max-height:80px">
        <div class="cdi-photo-status">Photo non ajoutée</div></td>

      <td><button type="button" class="cdi-remove">Supprimer</button></td>
    `;

    body.appendChild(row);

    row.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    row.querySelector('.cdi-photo').addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      const preview = row.querySelector('.cdi-preview');
      const status = row.querySelector('.cdi-photo-status');

      row.dataset.photo = '';
      preview.removeAttribute('src');
      preview.style.display = 'none';

      if (!file) {
        status.textContent = 'Photo non ajoutée';
        calculate();
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une photo valide.');
        event.target.value = '';
        status.textContent = 'Photo non ajoutée';
        calculate();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        row.dataset.photo = String(reader.result || '');
        preview.src = row.dataset.photo;
        preview.style.display = 'block';
        status.textContent = 'Photo ajoutée';
        calculate();
      };
      reader.readAsDataURL(file);
    });

    row.querySelector('.cdi-remove').addEventListener('click', () => {
      row.remove();
      calculate();
    });

    calculate();
  }

  function calculate() {
    if (!$('cdiProducts')) return;

    const products = Array.from(
      document.querySelectorAll('#cdiProducts tr')
    ).map((row, index) => {
      const name = row.querySelector('.cdi-name').value.trim();
      const unit = row.querySelector('.cdi-unit').value;
      const perCarton = Math.max(
        0, Number(row.querySelector('.cdi-percarton').value || 0)
      );
      const cartons = Math.max(
        0, Number(row.querySelector('.cdi-cartons').value || 0)
      );
      const basis = row.querySelector('.cdi-pricebasis').value;
      const currency = row.querySelector('.cdi-currency').value;
      const price = Math.max(
        0, Number(row.querySelector('.cdi-price').value || 0)
      );

      const quantity = perCarton * cartons;
      const purchase = basis === 'carton'
        ? price * cartons
        : price * quantity;

      const unitLabel = basis === 'carton'
        ? 'prix/carton'
        : 'prix/unité';

      row.querySelector('.cdi-quantity').textContent =
        fmt(quantity) + ' ' + unit;

      row.querySelector('.cdi-purchase').textContent =
        fmt(purchase) + ' ' + currency;

      return {
        row,
        name: name || 'Marchandise ' + (index + 1),
        unit,
        perCarton,
        cartons,
        quantity,
        basis,
        unitLabel,
        currency,
        price,
        purchase
      };
    });

    // Totaux conservés séparément par monnaie : aucune conversion.
    const totals = {};
    products.forEach(p => {
      totals[p.currency] = (totals[p.currency] || 0) + p.purchase;
    });

    $('cdiPurchaseTotals').innerHTML =
      Object.keys(totals).length
        ? Object.entries(totals).map(([currency, total]) =>
            `<div class="cdi-stat">
              <span>Total des achats (${esc(currency)})</span>
              <strong>${fmt(total)} ${esc(currency)}</strong>
            </div>`
          ).join('')
        : '<p>Aucun achat enregistré.</p>';

    const expenseTypes = [
      ['cdiFreight', 'cdiFreightCurrency'],
      ['cdiCustoms', 'cdiCustomsCurrency'],
      ['cdiOther', 'cdiOtherCurrency']
    ];

    const expenseTotals = {};
    expenseTypes.forEach(([amountId, currencyId]) => {
      const amount = Math.max(0, Number($(amountId).value || 0));
      const currency = $(currencyId).value;
      expenseTotals[currency] = (expenseTotals[currency] || 0) + amount;
    });

    $('cdiExpenseTotals').innerHTML =
      Object.entries(expenseTotals).map(([currency, total]) =>
        `<div class="cdi-stat">
          <span>Total des frais (${esc(currency)})</span>
          <strong>${fmt(total)} ${esc(currency)}</strong>
        </div>`
      ).join('');

    $('cdiResults').innerHTML = products.map(p => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.unit)}</td>
        <td>${fmt(p.perCarton)}</td>
        <td>${fmt(p.cartons)}</td>
        <td>${fmt(p.quantity)} ${esc(p.unit)}</td>
        <td>${esc(p.unitLabel)}</td>
        <td>${fmt(p.price)} ${esc(p.currency)}</td>
        <td>${fmt(p.purchase)} ${esc(p.currency)}</td>
        <td>${p.row.dataset.photo
          ? '<img alt="Photo produit" src="' + p.row.dataset.photo +
            '" style="max-width:80px;max-height:65px">'
          : '<strong class="cdi-missing">Photo manquante</strong>'}</td>
      </tr>
    `).join('') ||
      '<tr><td colspan="9">Ajoutez une marchandise.</td></tr>';

    const missing = products.filter(p => !p.name || !p.row.dataset.photo);
    $('cdiNotice').textContent = missing.length
      ? 'Complétez le nom et ajoutez une photo pour chaque marchandise avant impression.'
      : 'Les monnaies restent séparées. Aucun taux de change, prix de vente ou bénéfice n’est calculé.';
  }

  function initialize() {
    if ($('chinaDubaiImport')) return;

    const container = document.querySelector('.container');
    if (!container) {
      console.warn('C.W.B Import: conteneur principal introuvable.');
      return;
    }

    const section = document.createElement('section');
    section.id = 'chinaDubaiImport';
    section.className = 'card hidden';

    section.innerHTML = `
      <h2>C.W.B China &amp; Dubai Import</h2>
      <p class="cdi-company">Camel Work and Business company</p>
      <p class="cdi-slogan">Better Quality is our priority</p>

      <div class="cdi-panel">
        <h3>1. Marchandises et prix d'achat</h3>
        <p>Choisissez le prix par carton OU le prix par unité.
          Ne saisissez pas les deux pour un même achat.</p>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Marchandise</th><th>Unité</th>
              <th>Unités/carton</th><th>Nombre de cartons</th>
              <th>Mode d'achat</th><th>Monnaie</th>
              <th>Prix saisi</th><th>Quantité totale</th>
              <th>Total achat</th><th>Photo obligatoire</th><th>Action</th>
            </tr></thead>
            <tbody id="cdiProducts"></tbody>
          </table>
        </div>
        <button type="button" id="cdiAdd">+ Ajouter une marchandise</button>
      </div>

      <div class="cdi-panel">
        <h3>2. Frais de toute l'importation</h3>
        <p>Entrez chaque dépense une seule fois pour l'ensemble de l'importation,
          et choisissez la monnaie utilisée.</p>
        <div class="cdi-grid">
          <div>
            <label for="cdiFreight">Transport — montant total</label>
            <input id="cdiFreight" type="number" min="0" step="0.001" value="0">
            <select id="cdiFreightCurrency" aria-label="Monnaie du transport">
              <option value="USD">USD</option><option value="CNY">CNY</option>
              <option value="BIF">FB/BIF</option><option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <label for="cdiCustoms">Douane OBR et port — total</label>
            <input id="cdiCustoms" type="number" min="0" step="0.001" value="0">
            <select id="cdiCustomsCurrency" aria-label="Monnaie des frais OBR">
              <option value="BIF">FB/BIF</option><option value="USD">USD</option>
              <option value="CNY">CNY</option><option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <label for="cdiOther">Autres dépenses — montant total</label>
            <input id="cdiOther" type="number" min="0" step="0.001" value="0">
            <select id="cdiOtherCurrency" aria-label="Monnaie des autres frais">
              <option value="BIF">FB/BIF</option><option value="USD">USD</option>
              <option value="CNY">CNY</option><option value="OTHER">Autre</option>
            </select>
          </div>
        </div>
      </div>

      <div class="cdi-panel">
        <h3>3. Totaux des achats par monnaie</h3>
        <div id="cdiPurchaseTotals" class="cdi-grid"></div>
        <h3>Totaux des frais par monnaie</h3>
        <div id="cdiExpenseTotals" class="cdi-grid"></div>
        <p id="cdiNotice" class="cdi-note"></p>
      </div>

      <div class="cdi-panel">
        <h3>4. Liste des marchandises</h3>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Marchandise</th><th>Unité</th><th>Unités/carton</th>
              <th>Cartons</th><th>Quantité totale</th><th>Mode de prix</th>
              <th>Prix saisi</th><th>Total achat</th><th>Photo</th>
            </tr></thead>
            <tbody id="cdiResults"></tbody>
          </table>
        </div>
        <button type="button" id="cdiPrint">Imprimer / Print</button>
      </div>

      <div class="cdi-panel">
        <strong>Important :</strong>
        <p>Le comptable calculera lui-même le taux de change du jour,
          le prix de vente en francs burundais et le bénéfice.</p>
        <p>Les données et photos restent temporairement dans cette page.
          La sauvegarde permanente Supabase et l'intégration à l'inventaire
          ne sont pas encore intégrées.</p>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #chinaDubaiImport {
        color:#172033 !important;
        background:#ffffff;
        font-size:16px;
      }
      #chinaDubaiImport h2,
      #chinaDubaiImport h3,
      #chinaDubaiImport p,
      #chinaDubaiImport label,
      #chinaDubaiImport th,
      #chinaDubaiImport td,
      #chinaDubaiImport strong,
      #chinaDubaiImport span {
        color:#172033 !important;
      }
      #chinaDubaiImport .cdi-company {font-weight:700;color:#9f1239 !important}
      #chinaDubaiImport .cdi-slogan {font-weight:700;color:#b91c1c !important}
      #chinaDubaiImport .cdi-panel {
        background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;
        padding:14px;margin:14px 0;
      }
      #chinaDubaiImport .cdi-grid {
        display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
        gap:12px;
      }
      #chinaDubaiImport label {display:block;font-weight:700;margin:8px 0 5px}
      #chinaDubaiImport input,
      #chinaDubaiImport select {
        display:block;width:100%;max-width:100%;box-sizing:border-box;
        padding:10px;margin:5px 0;border:1px solid #94a3b8;border-radius:7px;
        background:#ffffff !important;color:#111827 !important;
        font-size:16px;min-height:42px;
      }
      #chinaDubaiImport input::placeholder {color:#475569 !important;opacity:1}
      #chinaDubaiImport button {
        background:#b91c1c;color:#ffffff !important;border:0;border-radius:8px;
        padding:11px 14px;margin:6px;font-size:15px;font-weight:700;
      }
      #chinaDubaiImport .cdi-table-wrap {overflow:auto;max-width:100%}
      #chinaDubaiImport table {border-collapse:collapse;width:100%;min-width:1000px}
      #chinaDubaiImport th,#chinaDubaiImport td {
        padding:9px;border:1px solid #cbd5e1;text-align:left;
        vertical-align:top;color:#172033 !important;
      }
      #chinaDubaiImport th {background:#e2e8f0 !important;font-weight:700}
      #chinaDubaiImport .cdi-stat {
        background:#f1f5f9;border:1px solid #cbd5e1;padding:12px;border-radius:9px;
      }
      #chinaDubaiImport .cdi-stat strong {display:block;margin-top:6px;font-size:18px}
      #chinaDubaiImport .cdi-note {font-size:14px;color:#334155 !important}
      #chinaDubaiImport .cdi-missing {color:#b91c1c !important}
      @media(max-width:600px) {
        #chinaDubaiImport {font-size:15px}
        #chinaDubaiImport .cdi-panel {padding:10px}
      }
      @media print {
        body * {visibility:hidden}
        #chinaDubaiImport,#chinaDubaiImport * {visibility:visible}
        #chinaDubaiImport {position:absolute;left:0;top:0;width:100%;background:#fff}
        #chinaDubaiImport button {display:none}
        #chinaDubaiImport .cdi-table-wrap {overflow:visible}
        #chinaDubaiImport table {min-width:0;font-size:10px}
        #chinaDubaiImport th,#chinaDubaiImport td {padding:4px}
      }
    `;

    document.head.appendChild(style);
    container.appendChild(section);

    $('cdiAdd').addEventListener('click', addProduct);

    [
      'cdiFreight','cdiFreightCurrency','cdiCustoms',
      'cdiCustomsCurrency','cdiOther','cdiOtherCurrency'
    ].forEach(id => {
      $(id).addEventListener('input', calculate);
      $(id).addEventListener('change', calculate);
    });

    $('cdiPrint').addEventListener('click', () => {
      const rows = Array.from(document.querySelectorAll('#cdiProducts tr'));

      const missing = rows.find(row =>
        !row.querySelector('.cdi-name').value.trim() ||
        !row.dataset.photo
      );

      if (!rows.length || missing) {
        alert('Chaque marchandise doit avoir un nom et une photo avant impression.');
        if (missing) missing.scrollIntoView({
          behavior:'smooth', block:'center'
        });
        return;
      }

      window.print();
    });

    addProduct();
  }

  window.cwbInitChinaDubaiImport = initialize;
  window.cwbChinaDubaiCalculate = calculate;
})();
