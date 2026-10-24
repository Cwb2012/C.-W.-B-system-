/* C.W.B China & Dubai Import Module
   Product quantities and costs by original currency. No automatic BIF conversion.
   Supabase saving and inventory integration are not yet implemented.
*/
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const num = el =>
    Math.max(0, Number(el && el.value || 0));

  const fmt = n =>
    Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

  const esc = s =>
    String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  let itemNo = 0;

  function addProduct() {
    const body = $('cdiProducts');
    if (!body) return;

    const row = document.createElement('tr');
    row.dataset.id = String(++itemNo);

    row.innerHTML = `
      <td>
        <input class="cdi-name"
          placeholder="e.g. Clear Coat / Papier collant">
      </td>

      <td>
        <select class="cdi-unit">
          <option value="litres">Litres</option>
          <option value="pieces">Pieces</option>
          <option value="rolls">Rolls</option>
          <option value="boxes">Boxes</option>
          <option value="kg">Kilograms</option>
          <option value="sets">Sets</option>
          <option value="other">Other</option>
        </select>
      </td>

      <td>
        <input class="cdi-percarton"
          type="number" min="0" step="0.001"
          value="12" title="Units in one carton">
      </td>

      <td>
        <input class="cdi-cartons"
          type="number" min="0" step="1"
          value="30" title="Number of cartons">
      </td>

      <td>
        <select class="cdi-pricebasis">
          <option value="carton">Price/carton</option>
          <option value="unit">Price/unit</option>
        </select>
      </td>

      <td>
        <select class="cdi-currency">
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
        </select>
      </td>

      <td>
        <input class="cdi-price"
          type="number" min="0" step="0.01" value="0">
      </td>

      <td class="cdi-totalunits">360</td>
      <td class="cdi-unitprice">0</td>
      <td class="cdi-purchasetotal">0 USD</td>

      <td>
        <button type="button" class="cdi-remove">
          Remove
        </button>
      </td>
    `;

    body.appendChild(row);

    row.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', calculate);
    });

    row.querySelectorAll('select').forEach(el => {
      el.addEventListener('change', calculate);
    });

    row.querySelector('.cdi-remove').addEventListener(
      'click',
      () => {
        row.remove();
        calculate();
      }
    );

    calculate();
  }

  function calculate() {
    const sums = {
      USD: 0,
      CNY: 0
    };

    const rows = Array.from(
      document.querySelectorAll('#cdiProducts tr')
    );

    const products = rows.map((row, i) => {
      const name =
        row.querySelector('.cdi-name').value.trim()
        || 'Product ' + (i + 1);

      const unit =
        row.querySelector('.cdi-unit').value;

      const perCarton =
        num(row.querySelector('.cdi-percarton'));

      const cartons =
        num(row.querySelector('.cdi-cartons'));

      const basis =
        row.querySelector('.cdi-pricebasis').value;

      const currency =
        row.querySelector('.cdi-currency').value;

      const enteredPrice =
        num(row.querySelector('.cdi-price'));

      const units = perCarton * cartons;

      const total = basis === 'carton'
        ? enteredPrice * cartons
        : enteredPrice * units;

      const unitPrice = units > 0
        ? total / units
        : 0;

      sums[currency] += total;

      const unitLabels = {
        litres: 'L',
        pieces: 'pc',
        rolls: 'roll',
        boxes: 'box',
        kg: 'kg',
        sets: 'set',
        other: 'unit'
      };

      row.querySelector('.cdi-totalunits').textContent =
        fmt(units) + ' ' + unit;

      row.querySelector('.cdi-unitprice').textContent =
        fmt(unitPrice) + ' ' + currency + '/'
        + (unitLabels[unit] || 'unit');

      row.querySelector('.cdi-purchasetotal').textContent =
        fmt(total) + ' ' + currency;

      return {
        name,
        unit,
        units,
        currency,
        total,
        unitPrice
      };
    });

    const freight = num($('cdiFreight'));

    const customs = num($('cdiCustoms'));

    const customsCurrency =
      $('cdiCustomsCurrency').value;

    const other = num($('cdiOther'));

    const otherCurrency =
      $('cdiOtherCurrency').value;

    // Transport is kept in USD.
    const costs = {
      USD: freight,
      CNY: 0
    };

    costs[customsCurrency] += customs;
    costs[otherCurrency] += other;

    $('cdiPurchaseUSD').textContent =
      fmt(sums.USD) + ' USD';

    $('cdiPurchaseCNY').textContent =
      fmt(sums.CNY) + ' CNY';

    $('cdiFreightSummary').textContent =
      fmt(freight) + ' USD';

    $('cdiCostsUSD').textContent =
      fmt(costs.USD) + ' USD';

    $('cdiCostsCNY').textContent =
      fmt(costs.CNY) + ' CNY';

    $('cdiTotalUSD').textContent =
      fmt(sums.USD + costs.USD) + ' USD';

    $('cdiTotalCNY').textContent =
      fmt(sums.CNY + costs.CNY) + ' CNY';

    const hasBoth =
      sums.USD > 0 && sums.CNY > 0;

    $('cdiCurrencyNotice').textContent = hasBoth
      ? 'Products are purchased in both USD and CNY. Totals are shown separately; the calculator does not combine different currencies or convert to BIF.'
      : 'All amounts remain in their stated currency. Transport is kept in USD. No automatic conversion to BIF.';

    $('cdiResults').innerHTML = products.map(p => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.unit)}</td>
        <td>${fmt(p.units)}</td>
        <td>${fmt(p.total)} ${p.currency}</td>
        <td>${fmt(p.unitPrice)} ${p.currency}</td>
      </tr>
    `).join('') || `
      <tr>
        <td colspan="5">Add a product first.</td>
      </tr>
    `;
  }

  function initialize() {
    if ($('chinaDubaiImport')) return;

    const container =
      document.querySelector('.container');

    if (!container) return;

    const section = document.createElement('section');

    section.id = 'chinaDubaiImport';
    section.className = 'card hidden';

    section.innerHTML = `
      <h2>C.W.B China &amp; Dubai Import</h2>

      <p>Camel Work and Business company</p>

      <p>
        <strong>Better Quality is our priority</strong>
      </p>

      <p>
        Product purchase and import cost calculator /
        Calculateur des achats et frais d'importation
      </p>

      <div class="cdi-panel">
        <h3>1. Products / Marchandises</h3>

        <p>
          Choose the unit type, units per carton, number of
          cartons, and whether the price is per carton or per
          unit. Purchase currency can be USD or CNY.
        </p>

        <div class="cdi-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Units/carton</th>
                <th>Cartons</th>
                <th>Entered price</th>
                <th>Currency</th>
                <th>Price</th>
                <th>Total quantity</th>
                <th>Calculated unit price</th>
                <th>Purchase total</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody id="cdiProducts"></tbody>
          </table>
        </div>

        <button type="button" id="cdiAdd">
          + Add product / Ajouter une marchandise
        </button>
      </div>

      <div class="cdi-panel">
        <h3>2. Import costs / Frais d'importation</h3>

        <div class="cdi-grid">
          <div>
            <label>Supplier / Fournisseur</label>
            <input id="cdiSupplier">
          </div>

          <div>
            <label>Origin / Origine</label>
            <select id="cdiOrigin">
              <option>China / Chine</option>
              <option>Dubai / Dubaï</option>
              <option>China and Dubai / Chine et Dubaï</option>
            </select>
          </div>

          <div>
            <label>Transport / Freight (USD only)</label>
            <input id="cdiFreight"
              type="number" min="0" step="0.01" value="0">
          </div>

          <div>
            <label>Customs and port charges / Douane et port</label>
            <input id="cdiCustoms"
              type="number" min="0" step="0.01" value="0">

            <select id="cdiCustomsCurrency">
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
            </select>
          </div>

          <div>
            <label>Other expenses / Autres frais</label>
            <input id="cdiOther"
              type="number" min="0" step="0.01" value="0">

            <select id="cdiOtherCurrency">
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
            </select>
          </div>
        </div>

        <p class="cdi-note">
          No exchange rate is entered or applied. Do not add
          amounts in different currencies together.
        </p>
      </div>

      <div class="cdi-panel">
        <h3>3. Summary / Résumé</h3>

        <div class="cdi-grid">
          <div class="cdi-stat">
            Products purchase total (USD)
            <strong id="cdiPurchaseUSD">0 USD</strong>
          </div>

          <div class="cdi-stat">
            Products purchase total (CNY)
            <strong id="cdiPurchaseCNY">0 CNY</strong>
          </div>

          <div class="cdi-stat">
            Transport
            <strong id="cdiFreightSummary">0 USD</strong>
          </div>

          <div class="cdi-stat">
            Total import costs (USD)
            <strong id="cdiCostsUSD">0 USD</strong>
          </div>

          <div class="cdi-stat">
            Total import costs (CNY)
            <strong id="cdiCostsCNY">0 CNY</strong>
          </div>

          <div class="cdi-stat">
            Products + matching-currency costs (USD)
            <strong id="cdiTotalUSD">0 USD</strong>
          </div>

          <div class="cdi-stat">
            Products + matching-currency costs (CNY)
            <strong id="cdiTotalCNY">0 CNY</strong>
          </div>
        </div>

        <p id="cdiCurrencyNotice" class="cdi-note">
          Totals are kept separate by currency.
        </p>

        <h3>
          Product quantities and unit costs /
          Quantités et coûts unitaires
        </h3>

        <div class="cdi-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit</th>
                <th>Total quantity</th>
                <th>Purchase total</th>
                <th>Price per unit</th>
              </tr>
            </thead>

            <tbody id="cdiResults"></tbody>
          </table>
        </div>

        <button type="button" id="cdiPrint">
          Print / Imprimer
        </button>
      </div>

      <div class="cdi-panel">
        <h3>Important / Important</h3>

        <p>
          This calculator does not save orders to Supabase
          or update inventory yet. The accountant will convert
          amounts to BIF separately using the actual exchange
          rate used by C.W.B.
        </p>
      </div>
    `;

    const style = document.createElement('style');

    style.textContent = `
      #chinaDubaiImport {
        color: #172033;
      }

      #chinaDubaiImport .cdi-panel {
        background: #fff;
        border: 1px solid #dbe1ea;
        border-radius: 12px;
        padding: 14px;
        margin: 14px 0;
      }

      #chinaDubaiImport .cdi-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(180px, 1fr)
        );
        gap: 10px;
      }

      #chinaDubaiImport label {
        display: block;
        font-weight: 600;
        margin: 7px 0 4px;
      }

      #chinaDubaiImport input,
      #chinaDubaiImport select {
        max-width: 100%;
        box-sizing: border-box;
        padding: 9px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
      }

      #chinaDubaiImport button {
        background: #b91c1c;
        color: #fff;
        border: 0;
        border-radius: 8px;
        padding: 10px 13px;
        margin: 5px;
        cursor: pointer;
      }

      #chinaDubaiImport .cdi-table-wrap {
        overflow: auto;
      }

      #chinaDubaiImport table {
        border-collapse: collapse;
        width: 100%;
        min-width: 1050px;
      }

      #chinaDubaiImport th,
      #chinaDubaiImport td {
        padding: 8px;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
        vertical-align: top;
      }

      #chinaDubaiImport th {
        background: #f1f5f9;
      }

      #chinaDubaiImport .cdi-stat {
        background: #f1f5f9;
        padding: 12px;
        border-radius: 9px;
      }

      #chinaDubaiImport .cdi-stat strong {
        display: block;
        margin-top: 5px;
        font-size: 18px;
      }

      #chinaDubaiImport .cdi-note {
        font-size: 13px;
        color: #64748b;
      }

      @media print {
        body * {
          visibility: hidden;
        }

        #chinaDubaiImport,
        #chinaDubaiImport * {
          visibility: visible;
        }

        #chinaDubaiImport {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }

        #chinaDubaiImport button {
          display: none;
        }
      }
    `;

    document.head.appendChild(style);
    container.appendChild(section);

    $('cdiAdd').addEventListener('click', addProduct);

    $('cdiPrint').addEventListener(
      'click',
      () => window.print()
    );

    [
      'cdiFreight',
      'cdiCustoms',
      'cdiCustomsCurrency',
      'cdiOther',
      'cdiOtherCurrency'
    ].forEach(id => {
      $(id).addEventListener('input', calculate);
    });

    [
      'cdiCustomsCurrency',
      'cdiOtherCurrency'
    ].forEach(id => {
      $(id).addEventListener('change', calculate);
    });

    addProduct();
  }

  window.cwbInitChinaDubaiImport = initialize;
  window.cwbChinaDubaiCalculate = calculate;

})();
