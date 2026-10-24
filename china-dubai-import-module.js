
/* C.W.B China & Dubai Import Module
   Achat, douane OBR, transport, autres frais, prix de vente BIF,
   TVA incluse dans le prix client, bénéfice estimé et photos.
   Sauvegarde Supabase et intégration inventaire à faire séparément.
*/
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const num = el =>
    Math.max(0, Number(el && el.value || 0));

  const fmt = n =>
    Number(n || 0).toLocaleString('fr-FR', {
      maximumFractionDigits: 2
    });

  const esc = s =>
    String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    }[c]));

  let itemNo = 0;

  function addProduct() {
    const body = $('cdiProducts');
    if (!body) return;

    const row = document.createElement('tr');
    row.dataset.id = String(++itemNo);
    row.dataset.photo = '';

    row.innerHTML = `
      <td><input class="cdi-name"
        placeholder="Vernis / Papier collant" required></td>

      <td><select class="cdi-unit">
        <option value="litres">Litres</option>
        <option value="pieces">Pièces</option>
        <option value="rolls">Rouleaux</option>
        <option value="boxes">Cartons</option>
        <option value="kg">Kg</option>
        <option value="sets">Sets</option>
        <option value="other">Autre</option>
      </select></td>

      <td><input class="cdi-percarton"
        type="number" min="0" step="0.001" value="12"></td>

      <td><input class="cdi-cartons"
        type="number" min="0" step="1" value="30"></td>

      <td><select class="cdi-pricebasis">
        <option value="carton">Prix/carton</option>
        <option value="unit">Prix/unité</option>
      </select></td>

      <td><select class="cdi-currency">
        <option value="USD">USD</option>
        <option value="CNY">CNY</option>
      </select></td>

      <td><input class="cdi-price"
        type="number" min="0" step="0.01" value="0"></td>

      <td>
        <input class="cdi-photo" type="file"
          accept="image/*" capture="environment" required>
        <img class="cdi-preview" alt="Photo produit"
          style="display:none;max-width:80px;max-height:70px">
      </td>

      <td class="cdi-quantity">0</td>
      <td class="cdi-purchase">0</td>

      <td><input class="cdi-selling"
        type="number" min="0" step="1" value="0"
        placeholder="Prix vente BIF/unité"></td>

      <td><button type="button" class="cdi-remove">
        Supprimer
      </button></td>
    `;

    body.appendChild(row);

    row.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    });

    row.querySelector('.cdi-photo').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      const preview = row.querySelector('.cdi-preview');

      if (!file) {
        row.dataset.photo = '';
        preview.style.display = 'none';
        calculate();
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('Veuillez choisir une photo valide.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        row.dataset.photo = String(reader.result || '');
        preview.src = row.dataset.photo;
        preview.style.display = 'block';
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

    const rates = {
      USD: num($('cdiUsdRate')),
      CNY: num($('cdiCnyRate'))
    };

    const products = Array.from(
      document.querySelectorAll('#cdiProducts tr')
    ).map((row, i) => {
      const name =
        row.querySelector('.cdi-name').value.trim()
        || 'Marchandise ' + (i + 1);

      const unit = row.querySelector('.cdi-unit').value;
      const perCarton = num(row.querySelector('.cdi-percarton'));
      const cartons = num(row.querySelector('.cdi-cartons'));
      const basis = row.querySelector('.cdi-pricebasis').value;
      const currency = row.querySelector('.cdi-currency').value;
      const price = num(row.querySelector('.cdi-price'));

      const quantity = perCarton * cartons;
      const purchase = basis === 'carton'
        ? price * cartons
        : price * quantity;

      const purchaseBif = purchase * rates[currency];

      row.querySelector('.cdi-quantity').textContent =
        fmt(quantity) + ' ' + unit;

      row.querySelector('.cdi-purchase').textContent =
        fmt(purchase) + ' ' + currency;

      return {
        row, name, unit, quantity, currency, purchase,
        purchaseBif,
        selling: num(row.querySelector('.cdi-selling'))
      };
    });

    const purchaseUSD = products
      .filter(p => p.currency === 'USD')
      .reduce((s, p) => s + p.purchase, 0);

    const purchaseCNY = products
      .filter(p => p.currency === 'CNY')
      .reduce((s, p) => s + p.purchase, 0);

    const purchaseBifAll = products
      .reduce((s, p) => s + p.purchaseBif, 0);

    const freight = num($('cdiFreight'));
    const customs = num($('cdiCustoms'));
    const other = num($('cdiOther'));

    const toBif = (amount, currency) =>
      currency === 'BIF' ? amount : amount * rates[currency];

    const freightBif = toBif(
      freight, $('cdiFreightCurrency').value
    );

    const customsBif = toBif(
      customs, $('cdiCustomsCurrency').value
    );

    const otherBif = toBif(
      other, $('cdiOtherCurrency').value
    );

    // Douane OBR, transport et autres frais sont des montants totaux.
    const importCostsBif = freightBif + customsBif + otherBif;

    const landedTotalBif = purchaseBifAll + importCostsBif;
    const vatRate = num($('cdiVatRate')) / 100;

    let sellingTotal = 0;
    let vatTotal = 0;
    let profitTotal = 0;

    products.forEach(p => {
      // Répartition des frais selon la valeur d'achat convertie en BIF.
      const share = purchaseBifAll > 0
        ? p.purchaseBif / purchaseBifAll
        : 0;

      p.importShare = importCostsBif * share;
      p.landedBif = p.purchaseBif + p.importShare;
      p.unitCostBif = p.quantity > 0
        ? p.landedBif / p.quantity
        : 0;

      p.sellingTotal = p.selling * p.quantity;

      // TVA comprise dans le prix de vente final.
      p.vat = vatRate > 0
        ? p.sellingTotal * vatRate / (1 + vatRate)
        : 0;

      p.profit = p.sellingTotal - p.vat - p.landedBif;

      sellingTotal += p.sellingTotal;
      vatTotal += p.vat;
      profitTotal += p.profit;
    });

    $('cdiPurchaseUSD').textContent = fmt(purchaseUSD) + ' USD';
    $('cdiPurchaseCNY').textContent = fmt(purchaseCNY) + ' CNY';
    $('cdiImportCosts').textContent = fmt(importCostsBif) + ' FB/BIF';
    $('cdiLandedTotal').textContent = fmt(landedTotalBif) + ' FB/BIF';
    $('cdiSellingTotal').textContent = fmt(sellingTotal) + ' FB/BIF';
    $('cdiVatTotal').textContent = fmt(vatTotal) + ' FB/BIF';
    $('cdiProfitTotal').textContent = fmt(profitTotal) + ' FB/BIF';

    $('cdiNotice').textContent =
      (!rates.USD || !rates.CNY)
        ? 'Entrez les taux réels USD→BIF et CNY→BIF avant de vous fier aux résultats.'
        : 'Les frais totaux sont répartis entre les produits selon leur valeur d’achat convertie en BIF. Vérifiez les frais et taux avec vos justificatifs.';

    $('cdiResults').innerHTML = products.map(p => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.unit)}</td>
        <td>${fmt(p.quantity)}</td>
        <td>${fmt(p.purchase)} ${p.currency}</td>
        <td>${fmt(p.landedBif)} BIF</td>
        <td>${fmt(p.unitCostBif)} BIF</td>
        <td>${fmt(p.selling)} BIF</td>
        <td>${fmt(p.sellingTotal)} BIF</td>
        <td>${fmt(p.profit)} BIF</td>
        <td>${p.row.dataset.photo
          ? '<img alt="Photo produit" src="' + p.row.dataset.photo +
            '" style="max-width:70px;max-height:60px">'
          : 'Photo manquante'}</td>
      </tr>
    `).join('') ||
      '<tr><td colspan="10">Ajoutez une marchandise.</td></tr>';
  }

  function initialize() {
    if ($('chinaDubaiImport')) return;

    const container = document.querySelector('.container');
    if (!container) return;

    const section = document.createElement('section');
    section.id = 'chinaDubaiImport';
    section.className = 'card hidden';

    section.innerHTML = `
      <h2>C.W.B China &amp; Dubai Import</h2>
      <p>Camel Work and Business company</p>
      <p><strong>Better Quality is our priority</strong></p>

      <div class="cdi-panel">
        <h3>1. Marchandises — photo obligatoire</h3>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Produit</th><th>Unité</th><th>Unités/carton</th>
              <th>Cartons</th><th>Prix saisi</th><th>Devise</th>
              <th>Prix d'achat</th><th>Photo</th><th>Quantité totale</th>
              <th>Total achat</th><th>Prix de vente/unité BIF</th><th>Action</th>
            </tr></thead>
            <tbody id="cdiProducts"></tbody>
          </table>
        </div>
        <button type="button" id="cdiAdd">+ Ajouter une marchandise</button>
      </div>

      <div class="cdi-panel">
        <h3>2. Taux de change et frais totaux</h3>
        <div class="cdi-grid">
          <div><label>Taux USD → BIF</label>
            <input id="cdiUsdRate" type="number" min="0" step="1" value="0"></div>
          <div><label>Taux CNY → BIF</label>
            <input id="cdiCnyRate" type="number" min="0" step="0.01" value="0"></div>
          <div><label>Transport — montant total</label>
            <input id="cdiFreight" type="number" min="0" step="0.01" value="0">
            <select id="cdiFreightCurrency">
              <option value="USD">USD</option><option value="CNY">CNY</option>
              <option value="BIF">FB/BIF</option>
            </select></div>
          <div><label>Douane OBR et port — total de l'importation</label>
            <input id="cdiCustoms" type="number" min="0" step="0.01" value="0">
            <select id="cdiCustomsCurrency">
              <option value="BIF">FB/BIF</option><option value="USD">USD</option>
              <option value="CNY">CNY</option>
            </select></div>
          <div><label>Autres frais — montant total</label>
            <input id="cdiOther" type="number" min="0" step="0.01" value="0">
            <select id="cdiOtherCurrency">
              <option value="BIF">FB/BIF</option><option value="USD">USD</option>
              <option value="CNY">CNY</option>
            </select></div>
          <div><label>TVA incluse dans le prix de vente (%)</label>
            <input id="cdiVatRate" type="number" min="0" step="0.1" value="18"></div>
        </div>
        <p class="cdi-note">
          Saisissez la douane OBR, le transport et les autres frais
          comme montants totaux. Les frais sont répartis selon la
          valeur d'achat de chaque produit.
        </p>
      </div>

      <div class="cdi-panel">
        <h3>3. Résumé et bénéfice estimé</h3>
        <div class="cdi-grid">
          <div class="cdi-stat">Achats USD<strong id="cdiPurchaseUSD">0 USD</strong></div>
          <div class="cdi-stat">Achats CNY<strong id="cdiPurchaseCNY">0 CNY</strong></div>
          <div class="cdi-stat">Douane + transport + autres frais<strong id="cdiImportCosts">0 BIF</strong></div>
          <div class="cdi-stat">Coût total réel<strong id="cdiLandedTotal">0 BIF</strong></div>
          <div class="cdi-stat">Ventes estimées<strong id="cdiSellingTotal">0 BIF</strong></div>
          <div class="cdi-stat">TVA incluse dans les ventes<strong id="cdiVatTotal">0 BIF</strong></div>
          <div class="cdi-stat">Bénéfice estimé après TVA<strong id="cdiProfitTotal">0 BIF</strong></div>
        </div>
        <p id="cdiNotice" class="cdi-note"></p>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Produit</th><th>Unité</th><th>Quantité</th>
              <th>Achat total</th><th>Coût réel total BIF</th>
              <th>Coût réel/unité BIF</th><th>Prix vente/unité BIF</th>
              <th>Ventes BIF</th><th>Bénéfice estimé BIF</th><th>Photo</th>
            </tr></thead>
            <tbody id="cdiResults"></tbody>
          </table>
        </div>
        <button type="button" id="cdiPrint">Imprimer / Print</button>
      </div>

      <div class="cdi-panel">
        <strong>À savoir :</strong> les calculs et photos restent dans cette
        page pendant la session. L'enregistrement permanent dans Supabase
        et la mise à jour de l'inventaire ne sont pas encore intégrés.
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #chinaDubaiImport{color:#172033}
      #chinaDubaiImport .cdi-panel{background:#fff;border:1px solid #dbe1ea;border-radius:12px;padding:14px;margin:14px 0}
      #chinaDubaiImport .cdi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
      #chinaDubaiImport label{display:block;font-weight:600;margin:7px 0 4px}
      #chinaDubaiImport input,#chinaDubaiImport select{max-width:100%;box-sizing:border-box;padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
      #chinaDubaiImport button{background:#b91c1c;color:#fff;border:0;border-radius:8px;padding:10px 13px;margin:5px}
      #chinaDubaiImport .cdi-table-wrap{overflow:auto}
      #chinaDubaiImport table{border-collapse:collapse;width:100%;min-width:1100px}
      #chinaDubaiImport th,#chinaDubaiImport td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      #chinaDubaiImport th{background:#f1f5f9}
      #chinaDubaiImport .cdi-stat{background:#f1f5f9;padding:12px;border-radius:9px}
      #chinaDubaiImport .cdi-stat strong{display:block;margin-top:5px;font-size:18px}
      #chinaDubaiImport .cdi-note{font-size:13px;color:#64748b}
      @media print{body *{visibility:hidden}#chinaDubaiImport,#chinaDubaiImport *{visibility:visible}#chinaDubaiImport{position:absolute;left:0;top:0;width:100%}#chinaDubaiImport button{display:none}}
    `;

    document.head.appendChild(style);
    container.appendChild(section);

    $('cdiAdd').addEventListener('click', addProduct);

    $('cdiPrint').addEventListener('click', () => {
      const rows = Array.from(
        document.querySelectorAll('#cdiProducts tr')
      );

      const missing = rows.find(row =>
        !row.querySelector('.cdi-name').value.trim() ||
        !row.dataset.photo
      );

      if (!rows.length || missing) {
        alert('Chaque marchandise doit avoir un nom et une photo avant impression.');
        if (missing) missing.scrollIntoView({
          behavior: 'smooth', block: 'center'
        });
        return;
      }

      window.print();
    });

    [
      'cdiUsdRate','cdiCnyRate','cdiFreight','cdiFreightCurrency',
      'cdiCustoms','cdiCustomsCurrency','cdiOther',
      'cdiOtherCurrency','cdiVatRate'
    ].forEach(id => {
      $(id).addEventListener('input', calculate);
      $(id).addEventListener('change', calculate);
    });

    addProduct();
  }

  window.cwbInitChinaDubaiImport = initialize;
  window.cwbChinaDubaiCalculate = calculate;
})();
