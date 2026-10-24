
/* C.W.B China & Dubai Import Module
   Prix unitaire + prix carton, quantité automatique, photos.
   Pas de conversion de devises, prix de vente ou bénéfice.
   Les données restent temporaires jusqu'à l'intégration Supabase.
*/
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  let itemNo = 0;

  const fmt = n => Number(n || 0).toLocaleString('fr-FR', {
    maximumFractionDigits: 3
  });

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;',
    '"':'&quot;', "'":'&#39;'
  }[c]));

  function addProduct() {
    const body = $('cdiProducts');
    if (!body) return;

    const row = document.createElement('tr');
    row.dataset.id = String(++itemNo);
    row.dataset.photo = '';

    row.innerHTML = `
      <td>
        <input class="cdi-name" placeholder="Nom du produit" required>
      </td>
      <td>
        <select class="cdi-unit">
          <option value="pièces">Pièces</option>
          <option value="litres">Litres</option>
          <option value="rouleaux">Rouleaux</option>
          <option value="cartons">Cartons</option>
          <option value="kg">Kg</option>
          <option value="sets">Sets</option>
          <option value="autre">Autre</option>
        </select>
      </td>
      <td>
        <label>Pièces par carton</label>
        <input class="cdi-percarton" type="number" min="0"
          step="any" placeholder="Entrer quantité">
      </td>
      <td>
        <label>Nombre de cartons</label>
        <input class="cdi-cartons" type="number" min="0"
          step="any" placeholder="Entrer cartons">
      </td>
      <td>
        <label>Prix calculé selon</label>
        <select class="cdi-basis">
          <option value="unit">Prix unitaire</option>
          <option value="carton">Prix par carton</option>
        </select>
      </td>
      <td>
        <label>Prix unitaire</label>
        <input class="cdi-unitprice" type="number" min="0"
          step="any" placeholder="Prix d'une pièce">
      </td>
      <td>
        <label>Prix par carton</label>
        <input class="cdi-cartonprice" type="number" min="0"
          step="any" placeholder="Prix d'un carton">
      </td>
      <td>
        <select class="cdi-currency" aria-label="Monnaie">
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
          <option value="BIF">FB/BIF</option>
          <option value="OTHER">Autre monnaie</option>
        </select>
      </td>
      <td><strong class="cdi-quantity">—</strong></td>
      <td><strong class="cdi-total">—</strong></td>
      <td>
        <label>Photo obligatoire</label>
        <input class="cdi-photo" type="file" accept="image/*" required>
        <img class="cdi-preview" alt="Aperçu photo"
          style="display:none;max-width:100px;max-height:80px">
        <div class="cdi-photo-status">Photo non choisie</div>
      </td>
      <td><button type="button" class="cdi-remove">Supprimer</button></td>
    `;

    body.appendChild(row);

    row.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    // La sélection de fichier permet de choisir la galerie ou l'appareil photo.
    row.querySelector('.cdi-photo').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      const preview = row.querySelector('.cdi-preview');
      const status = row.querySelector('.cdi-photo-status');

      row.dataset.photo = '';
      preview.removeAttribute('src');
      preview.style.display = 'none';

      if (!file) {
        status.textContent = 'Photo non choisie';
        calculate();
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Choisissez un fichier photo valide.');
        e.target.value = '';
        status.textContent = 'Photo non choisie';
        calculate();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        row.dataset.photo = String(reader.result || '');
        preview.src = row.dataset.photo;
        preview.style.display = 'block';
        status.textContent = 'Photo choisie';
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
      const perCarton = Number(row.querySelector('.cdi-percarton').value || 0);
      const cartons = Number(row.querySelector('.cdi-cartons').value || 0);
      const basis = row.querySelector('.cdi-basis').value;
      const currency = row.querySelector('.cdi-currency').value;

      let unitPrice = row.querySelector('.cdi-unitprice').value;
      let cartonPrice = row.querySelector('.cdi-cartonprice').value;

      unitPrice = unitPrice === '' ? null : Number(unitPrice);
      cartonPrice = cartonPrice === '' ? null : Number(cartonPrice);

      const quantity = perCarton * cartons;
      let total = null;

      if (basis === 'unit') {
        // Prix unitaire choisi : calcule le prix du carton et le total.
        if (unitPrice !== null && unitPrice >= 0) {
          total = unitPrice * quantity;
          if (perCarton > 0) {
            cartonPrice = unitPrice * perCarton;
          }
        }
      } else {
        // Prix carton choisi : calcule le prix unitaire et le total.
        if (cartonPrice !== null && cartonPrice >= 0) {
          total = cartonPrice * cartons;
          if (perCarton > 0) {
            unitPrice = cartonPrice / perCarton;
          }
        }
      }

      // Affiche le prix calculé dans l'autre champ sans le laisser modifier
      // le total tant que ce mode de prix n'est pas sélectionné.
      const unitInput = row.querySelector('.cdi-unitprice');
      const cartonInput = row.querySelector('.cdi-cartonprice');

      if (basis === 'unit') {
        cartonInput.value =
          unitPrice !== null && perCarton > 0
            ? fmt(unitPrice * perCarton).replace(/\s/g, '')
            : '';
      } else {
        unitInput.value =
          cartonPrice !== null && perCarton > 0
            ? fmt(cartonPrice / perCarton).replace(/\s/g, '')
            : '';
      }

      row.querySelector('.cdi-quantity').textContent =
        perCarton > 0 && cartons > 0
          ? fmt(quantity) + ' ' + unit
          : '—';

      row.querySelector('.cdi-total').textContent =
        total === null ? '—' : fmt(total) + ' ' + currency;

      return {
        row, name: name || 'Marchandise ' + (index + 1),
        unit, perCarton, cartons, quantity, basis,
        unitPrice, cartonPrice, currency, total
      };
    });

    // Total des achats groupé par devise, sans conversion.
    const purchaseTotals = {};
    products.forEach(p => {
      if (p.total !== null) {
        purchaseTotals[p.currency] =
          (purchaseTotals[p.currency] || 0) + p.total;
      }
    });

    $('cdiPurchaseTotals').innerHTML =
      Object.keys(purchaseTotals).length
        ? Object.entries(purchaseTotals).map(([cur, total]) => `
            <div class="cdi-stat">
              <span>Total des achats (${esc(cur)})</span>
              <strong>${fmt(total)} ${esc(cur)}</strong>
            </div>
          `).join('')
        : '<p>Aucun total calculé pour le moment.</p>';

    const expenseFields = [
      ['cdiFreight', 'cdiFreightCurrency'],
      ['cdiCustoms', 'cdiCustomsCurrency'],
      ['cdiOther', 'cdiOtherCurrency']
    ];

    const expenseTotals = {};
    expenseFields.forEach(([amountId, currencyId]) => {
      const amount = Number($(amountId).value || 0);
      const currency = $(currencyId).value;
      expenseTotals[currency] = (expenseTotals[currency] || 0) + amount;
    });

    $('cdiExpenseTotals').innerHTML =
      Object.entries(expenseTotals).map(([cur, total]) => `
        <div class="cdi-stat">
          <span>Total des frais (${esc(cur)})</span>
          <strong>${fmt(total)} ${esc(cur)}</strong>
        </div>
      `).join('');

    $('cdiResults').innerHTML = products.map(p => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.unit)}</td>
        <td>${p.perCarton ? fmt(p.perCarton) : '—'}</td>
        <td>${p.cartons ? fmt(p.cartons) : '—'}</td>
        <td>${p.quantity ? fmt(p.quantity) : '—'}</td>
        <td>${p.unitPrice !== null ? fmt(p.unitPrice) : '—'}</td>
        <td>${p.cartonPrice !== null ? fmt(p.cartonPrice) : '—'}</td>
        <td>${p.total !== null ? fmt(p.total) + ' ' + esc(p.currency) : '—'}</td>
        <td>${p.row.dataset.photo
          ? '<img alt="Photo produit" src="' + p.row.dataset.photo +
            '" style="max-width:80px;max-height:65px">'
          : '<strong class="cdi-missing">Photo manquante</strong>'}</td>
      </tr>
    `).join('') || '<tr><td colspan="9">Ajoutez une marchandise.</td></tr>';

    const missing = products.filter(p =>
      !p.row.querySelector('.cdi-name').value.trim() ||
      !p.row.dataset.photo
    );

    $('cdiNotice').textContent = missing.length
      ? 'Ajoutez le nom et la photo de chaque marchandise avant impression.'
      : 'Aucune conversion de devise, aucun prix de vente et aucun bénéfice calculés.';
  }

  function initialize() {
    if ($('chinaDubaiImport')) return;

    const container = document.querySelector('.container');
    if (!container) {
      console.warn('C.W.B Import : conteneur principal introuvable.');
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
        <p>Choisissez si le total doit être calculé avec le prix unitaire
        ou le prix par carton. L'autre prix sera calculé automatiquement.
        Les champs commencent vides.</p>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Produit</th><th>Unité</th><th>Pièces/carton</th>
              <th>Cartons</th><th>Mode de calcul</th>
              <th>Prix unitaire</th><th>Prix/carton</th><th>Devise</th>
              <th>Quantité totale</th><th>Total achat</th>
              <th>Photo obligatoire</th><th>Action</th>
            </tr></thead>
            <tbody id="cdiProducts"></tbody>
          </table>
        </div>
        <button type="button" id="cdiAdd">+ Ajouter une marchandise</button>
      </div>

      <div class="cdi-panel">
        <h3>2. Frais de toute l'importation</h3>
        <p>Saisissez chaque dépense totale une seule fois.
        Les montants restent dans leur devise d'origine.</p>
        <div class="cdi-grid">
          <div>
            <label for="cdiFreight">Transport — montant total</label>
            <input id="cdiFreight" type="number" min="0" step="any" placeholder="Montant">
            <select id="cdiFreightCurrency" aria-label="Monnaie du transport">
              <option value="USD">USD</option><option value="CNY">CNY</option>
              <option value="BIF">FB/BIF</option><option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <label for="cdiCustoms">Douane OBR et port — total</label>
            <input id="cdiCustoms" type="number" min="0" step="any" placeholder="Montant">
            <select id="cdiCustomsCurrency" aria-label="Monnaie des frais OBR">
              <option value="BIF">FB/BIF</option><option value="USD">USD</option>
              <option value="CNY">CNY</option><option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <label for="cdiOther">Autres dépenses — montant total</label>
            <input id="cdiOther" type="number" min="0" step="any" placeholder="Montant">
            <select id="cdiOtherCurrency" aria-label="Monnaie des autres frais">
              <option value="BIF">FB/BIF</option><option value="USD">USD</option>
              <option value="CNY">CNY</option><option value="OTHER">Autre</option>
            </select>
          </div>
        </div>
      </div>

      <div class="cdi-panel">
        <h3>3. Totaux des achats par devise</h3>
        <div id="cdiPurchaseTotals" class="cdi-grid"></div>
        <h3>Totaux des frais par devise</h3>
        <div id="cdiExpenseTotals" class="cdi-grid"></div>
        <p id="cdiNotice" class="cdi-note"></p>
      </div>

      <div class="cdi-panel">
        <h3>4. Résumé des marchandises</h3>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Produit</th><th>Unité</th><th>Pièces/carton</th>
              <th>Cartons</th><th>Quantité totale</th>
              <th>Prix unitaire</th><th>Prix/carton</th>
              <th>Total achat</th><th>Photo</th>
            </tr></thead>
            <tbody id="cdiResults"></tbody>
          </table>
        </div>
        <button type="button" id="cdiPrint">Imprimer / Print</button>
      </div>

      <div class="cdi-panel">
        <strong>Important :</strong>
        <p>Le comptable calculera le taux de change du jour,
        le prix de vente en francs burundais et le bénéfice.</p>
        <p>Les données et les photos ne sont pas encore sauvegardées
        durablement. L'intégration Supabase et l'inventaire restent à faire.</p>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #chinaDubaiImport {
        color:#172033 !important;background:#fff;font-size:16px;
      }
      #chinaDubaiImport h2,#chinaDubaiImport h3,
      #chinaDubaiImport p,#chinaDubaiImport label,
      #chinaDubaiImport th,#chinaDubaiImport td,
      #chinaDubaiImport strong,#chinaDubaiImport span {
        color:#172033 !important;
      }
      #chinaDubaiImport .cdi-company {
        font-weight:700;color:#9f1239 !important;
      }
      #chinaDubaiImport .cdi-slogan {
        font-weight:700;color:#b91c1c !important;
      }
      #chinaDubaiImport .cdi-panel {
        background:#fff;border:1px solid #cbd5e1;
        border-radius:12px;padding:14px;margin:14px 0;
      }
      #chinaDubaiImport .cdi-grid {
        display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
        gap:12px;
      }
      #chinaDubaiImport label {
        display:block;font-weight:700;margin:8px 0 5px;
      }
      #chinaDubaiImport input,#chinaDubaiImport select {
        display:block;width:100%;max-width:100%;box-sizing:border-box;
        padding:10px;margin:5px 0;border:1px solid #94a3b8;
        border-radius:7px;background:#fff !important;color:#111827 !important;
        font-size:16px;min-height:42px;
      }
      #chinaDubaiImport input::placeholder {
        color:#475569 !important;opacity:1;
      }
      #chinaDubaiImport button {
        background:#b91c1c;color:#fff !important;border:0;
        border-radius:8px;padding:11px 14px;margin:6px;
        font-size:15px;font-weight:700;
      }
      #chinaDubaiImport .cdi-table-wrap {overflow:auto;max-width:100%}
      #chinaDubaiImport table {
        border-collapse:collapse;width:100%;min-width:1200px;
      }
      #chinaDubaiImport th,#chinaDubaiImport td {
        padding:9px;border:1px solid #cbd5e1;text-align:left;
        vertical-align:top;color:#172033 !important;
      }
      #chinaDubaiImport th {background:#e2e8f0 !important;font-weight:700}
      #chinaDubaiImport .cdi-stat {
        background:#f1f5f9;border:1px solid #cbd5e1;
        padding:12px;border-radius:9px;
      }
      #chinaDubaiImport .cdi-stat strong {
        display:block;margin-top:6px;font-size:18px;
      }
      #chinaDubaiImport .cdi-note {font-size:14px;color:#334155 !important}
      #chinaDubaiImport .cdi-missing {color:#b91c1c !important}
      @media(max-width:600px) {
        #chinaDubaiImport {font-size:15px}
        #chinaDubaiImport .cdi-panel {padding:10px}
      }
      @media print {
        body * {visibility:hidden}
        #chinaDubaiImport,#chinaDubaiImport * {visibility:visible}
        #chinaDubaiImport {
          position:absolute;left:0;top:0;width:100%;background:#fff;
        }
        #chinaDubaiImport button {display:none}
        #chinaDubaiImport .cdi-table-wrap {overflow:visible}
        #chinaDubaiImport table {min-width:0;font-size:9px}
        #chinaDubaiImport th,#chinaDubaiImport td {padding:3px}
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
        !row.querySelector('.cdi-name').value.trim() || !row.dataset.photo
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
