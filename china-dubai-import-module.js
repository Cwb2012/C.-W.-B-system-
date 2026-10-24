/* C.W.B China & Dubai Import Module
   Separate from Japan Car Import.
   Calculator only: database and inventory integration come later.
*/
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const number = id => Math.max(0, Number($(id)?.value || 0));

  const money = value => Number(value || 0).toLocaleString('fr-BI', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[c]));

  let itemNumber = 0;

  function addProduct() {
    const body = $('cdiProducts');
    if (!body) return;

    const row = document.createElement('tr');
    row.dataset.id = String(++itemNumber);

    row.innerHTML = `
      <td><input class="cdi-name" placeholder="Product name"></td>
      <td><input class="cdi-qty" type="number" min="0" step="0.001" value="1"></td>
      <td>
        <select class="cdi-currency">
          <option>USD</option>
          <option>CNY</option>
          <option>AED</option>
          <option>BIF</option>
        </select>
      </td>
      <td><input class="cdi-price" type="number" min="0" step="0.01" value="0"></td>
      <td><input class="cdi-rate" type="number" min="0" step="0.0001" value="0" placeholder="Rate to BIF"></td>
      <td class="cdi-purchase-total">0</td>
      <td><button type="button" class="cdi-remove">Remove</button></td>
    `;

    body.appendChild(row);

    row.querySelector('.cdi-currency').addEventListener('change', () => {
      const currency = row.querySelector('.cdi-currency').value;
      row.querySelector('.cdi-rate').value = currency === 'BIF' ? '1' : '0';
      calculate();
    });

    row.querySelectorAll('input').forEach(input =>
      input.addEventListener('input', calculate)
    );

    row.querySelector('.cdi-remove').addEventListener('click', () => {
      row.remove();
      calculate();
    });

    calculate();
  }

  function calculate() {
    let purchaseTotal = 0;
    const rows = [...document.querySelectorAll('#cdiProducts tr')];

    const products = rows.map(row => {
      const qty = Math.max(0, Number(row.querySelector('.cdi-qty').value || 0));
      const price = Math.max(0, Number(row.querySelector('.cdi-price').value || 0));
      const rate = Math.max(0, Number(row.querySelector('.cdi-rate').value || 0));
      const total = qty * price * rate;

      row.querySelector('.cdi-purchase-total').textContent = money(total);
      purchaseTotal += total;

      return {
        name: row.querySelector('.cdi-name').value,
        qty,
        total
      };
    });

    const freight = number('cdiFreight');
    const customs = number('cdiCustoms');
    const other = number('cdiOther');
    const extraCosts = freight + customs + other;
    const landedTotal = purchaseTotal + extraCosts;

    const sellingPrice = number('cdiSelling');
    const vatRate = number('cdiVAT') / 100;
    const vatIncluded = vatRate >= 0
      ? sellingPrice * vatRate / (1 + vatRate)
      : 0;
    const revenueExVAT = sellingPrice - vatIncluded;
    const profit = revenueExVAT - landedTotal;

    $('cdiPurchaseTotal').textContent = money(purchaseTotal) + ' BIF';
    $('cdiExtraTotal').textContent = money(extraCosts) + ' BIF';
    $('cdiLandedTotal').textContent = money(landedTotal) + ' BIF';
    $('cdiVATAmount').textContent = money(vatIncluded) + ' BIF';
    $('cdiRevenue').textContent = money(revenueExVAT) + ' BIF';
    $('cdiProfit').textContent = money(profit) + ' BIF';
    $('cdiProfit').style.color = profit < 0 ? '#b91c1c' : '#166534';

    $('cdiResults').innerHTML = products.map((product, index) => {
      const share = purchaseTotal > 0 ? product.total / purchaseTotal : 0;
      const allocatedExtra = extraCosts * share;
      const landed = product.total + allocatedExtra;
      const perUnit = product.qty > 0 ? landed / product.qty : 0;

      return `<tr>
        <td>${escapeHTML(product.name || 'Product ' + (index + 1))}</td>
        <td>${money(product.qty)}</td>
        <td>${money(product.total)} BIF</td>
        <td>${money(allocatedExtra)} BIF</td>
        <td>${money(landed)} BIF</td>
        <td>${money(perUnit)} BIF</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">Add a product first.</td></tr>';
  }

  function initialize() {
    if ($('chinaDubaiImport')) return;

    const container = document.querySelector('.container');
    if (!container) return;

    const section = document.createElement('section');
    section.id = 'chinaDubaiImport';
    section.className = 'card hidden';

    section.innerHTML = `
      <h2>C.W.B China & Dubai Import</h2>
      <p>Camel Work and Business company</p>
      <p><strong>Better Quality is our priority</strong></p>
      <p>Merchandise import calculator / Calculateur d'importation de marchandises</p>

      <div class="cdi-panel">
        <h3>1. Products / Marchandises</h3>
        <p>Enter the purchase currency and the exchange rate into BIF for each product. For BIF, use rate 1.</p>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Product</th><th>Quantity</th><th>Currency</th>
              <th>Unit price</th><th>Rate to BIF</th><th>Purchase total (BIF)</th><th>Action</th>
            </tr></thead>
            <tbody id="cdiProducts"></tbody>
          </table>
        </div>
        <button type="button" id="cdiAdd">+ Add product / Ajouter</button>
      </div>

      <div class="cdi-panel">
        <h3>2. Import costs / Frais d'importation</h3>
        <div class="cdi-grid">
          <div><label>Supplier / Fournisseur</label><input id="cdiSupplier"></div>
          <div><label>Origin / Origine</label>
            <select id="cdiOrigin">
              <option>China / Chine</option>
              <option>Dubai / Dubaï</option>
              <option>China and Dubai / Chine et Dubaï</option>
            </select>
          </div>
          <div><label>Transport (BIF)</label><input id="cdiFreight" type="number" min="0" value="0"></div>
          <div><label>Customs and port taxes (BIF)</label><input id="cdiCustoms" type="number" min="0" value="0"></div>
          <div><label>Other expenses (BIF)</label><input id="cdiOther" type="number" min="0" value="0"></div>
          <div><label>Selling price including VAT (BIF)</label><input id="cdiSelling" type="number" min="0" value="0"></div>
          <div><label>VAT rate (%)</label><input id="cdiVAT" type="number" min="0" max="100" value="18"></div>
        </div>
        <p class="cdi-note">VAT is estimated as included in the selling price, as requested. Confirm the applicable Burundi tax treatment with your accountant or OBR before official tax reporting.</p>
      </div>

      <div class="cdi-panel">
        <h3>3. Cost and profit summary / Résumé</h3>
        <div class="cdi-grid">
          <div class="cdi-stat">Purchase total<strong id="cdiPurchaseTotal">0 BIF</strong></div>
          <div class="cdi-stat">Extra costs<strong id="cdiExtraTotal">0 BIF</strong></div>
          <div class="cdi-stat">Total landed cost<strong id="cdiLandedTotal">0 BIF</strong></div>
          <div class="cdi-stat">VAT included<strong id="cdiVATAmount">0 BIF</strong></div>
          <div class="cdi-stat">Revenue excluding VAT<strong id="cdiRevenue">0 BIF</strong></div>
          <div class="cdi-stat">Estimated profit<strong id="cdiProfit">0 BIF</strong></div>
        </div>

        <h3>Cost per product / Coût par produit</h3>
        <div class="cdi-table-wrap">
          <table>
            <thead><tr>
              <th>Product</th><th>Quantity</th><th>Purchase cost</th>
              <th>Allocated extra costs</th><th>Landed cost</th><th>Cost per unit</th>
            </tr></thead>
            <tbody id="cdiResults"></tbody>
          </table>
        </div>
        <p class="cdi-note">Extra costs are allocated proportionally to purchase value. Profit is an estimate before any unentered costs.</p>
        <button type="button" id="cdiPrint">Print / Imprimer</button>
      </div>

      <div class="cdi-panel">
        <h3>Important / Important</h3>
        <p>This is the calculator foundation only. It does not yet save orders to Supabase or change inventory. Database security and inventory integration must be completed before business use.</p>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #chinaDubaiImport{color:#172033}
      #chinaDubaiImport .cdi-panel{background:#fff;border:1px solid #dbe1ea;border-radius:12px;padding:14px;margin:14px 0}
      #chinaDubaiImport .cdi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
      #chinaDubaiImport label{display:block;font-weight:600;margin:7px 0 4px}
      #chinaDubaiImport input,#chinaDubaiImport select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
      #chinaDubaiImport button{background:#b91c1c;color:#fff;border:0;border-radius:8px;padding:10px 13px;margin:5px;cursor:pointer}
      #chinaDubaiImport .cdi-table-wrap{overflow:auto}
      #chinaDubaiImport table{border-collapse:collapse;width:100%;min-width:760px}
      #chinaDubaiImport th,#chinaDubaiImport td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}
      #chinaDubaiImport th{background:#f1f5f9}
      #chinaDubaiImport .cdi-stat{background:#f1f5f9;padding:12px;border-radius:9px}
      #chinaDubaiImport .cdi-stat strong{display:block;margin-top:5px;font-size:18px}
      #chinaDubaiImport .cdi-note{font-size:13px;color:#64748b}
      @media print{body *{visibility:hidden}#chinaDubaiImport,#chinaDubaiImport *{visibility:visible}#chinaDubaiImport{position:absolute;left:0;top:0;width:100%}#chinaDubaiImport button{display:none}}
    `;
    document.head.appendChild(style);
    container.appendChild(section);

    $('cdiAdd').addEventListener('click', addProduct);
    $('cdiPrint').addEventListener('click', () => window.print());

    ['cdiFreight','cdiCustoms','cdiOther','cdiSelling','cdiVAT']
      .forEach(id => $(id).addEventListener('input', calculate));

    addProduct();
  }

  window.cwbInitChinaDubaiImport = initialize;
  window.cwbChinaDubaiCalculate = calculate;
})();
