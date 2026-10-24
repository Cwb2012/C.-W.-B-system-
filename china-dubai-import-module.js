
/* C.W.B System — China & Dubai Import Module
   Product photos, quantity and carton calculations,
   separate USD/CNY totals, and Burundi date/time.
*/
(function () {
  'use strict';

  const MODULE_ID = 'chinaDubaiImport';
  let records = [];
  let activePhoto = '';

  const $ = id => document.getElementById(id);
  const number = id => Math.max(0, Number($(id)?.value || 0));

  const money = value => Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[c]);

  function localDateTime() {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Bujumbura',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
  }

  function initialize() {
    if ($(MODULE_ID)) {
      bind();
      return;
    }

    const parent = document.querySelector('.container')
      || document.querySelector('main')
      || document.body;

    const section = document.createElement('section');
    section.id = MODULE_ID;
    section.className = 'card hidden';

    section.innerHTML = `
      <h2>C.W.B China &amp; Dubai Import</h2>
      <p><strong>Camel Work and Business company</strong></p>
      <p>Better Quality is our priority</p>

      <div class="cdi-panel">
        <h3>1. Product information / Informations du produit</h3>

        <label for="cdiName">Product name / Nom du produit</label>
        <input id="cdiName" type="text"
          placeholder="Vernis, papier collant, peinture...">

        <label>Product photo / Photo du produit</label>
        <div class="cdi-actions">
          <button type="button" id="cdiGalleryButton">
            📁 Choose from gallery / Galerie
          </button>
          <button type="button" id="cdiCameraButton">
            📷 Take a photo / Appareil photo
          </button>
        </div>

        <input id="cdiGallery" type="file"
          accept="image/*" style="display:none">

        <input id="cdiCamera" type="file"
          accept="image/*" capture="environment"
          style="display:none">

        <img id="cdiPhotoPreview" alt="Product photo"
          style="display:none;max-width:240px;max-height:240px;
          object-fit:contain;margin:12px 0;border-radius:8px">

        <label for="cdiUnit">Unit / Unité</label>
        <select id="cdiUnit">
          <option value="litres">Litres</option>
          <option value="pieces">Pieces / Pièces</option>
          <option value="rolls">Rolls / Rouleaux</option>
          <option value="boxes">Boxes / Boîtes</option>
          <option value="kg">Kilograms / Kilogrammes</option>
          <option value="sets">Sets / Ensembles</option>
          <option value="other">Other / Autre</option>
        </select>

        <label for="cdiPerCarton">Units per carton / Unités par carton</label>
        <input id="cdiPerCarton" type="number"
          min="0" step="0.001" value="12">

        <label for="cdiCartons">Number of cartons / Nombre de cartons</label>
        <input id="cdiCartons" type="number"
          min="0" step="1" value="1">

        <label for="cdiBasis">Price basis / Type de prix</label>
        <select id="cdiBasis">
          <option value="unit">Price per unit / Prix par unité</option>
          <option value="carton">Price per carton / Prix par carton</option>
        </select>

        <label for="cdiCurrency">Purchase currency / Devise d'achat</label>
        <select id="cdiCurrency">
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
        </select>

        <label for="cdiPrice">Entered price / Prix indiqué</label>
        <input id="cdiPrice" type="number"
          min="0" step="0.0001" value="0">

        <div class="cdi-results">
          <p>Total quantity / Quantité totale:
            <strong id="cdiQuantity">12 litres</strong>
          </p>
          <p>Price per unit / Prix par unité:
            <strong id="cdiUnitPrice">0 USD</strong>
          </p>
          <p>Price per carton / Prix par carton:
            <strong id="cdiCartonPrice">0 USD</strong>
          </p>
          <p>Purchase total / Total d'achat:
            <strong id="cdiProductTotal">0 USD</strong>
          </p>
        </div>
      </div>

      <div class="cdi-panel">
        <h3>2. Import costs / Frais d'importation</h3>

        <label for="cdiSupplier">Supplier / Fournisseur</label>
        <input id="cdiSupplier" placeholder="Supplier name">

        <label for="cdiOrigin">Origin / Origine</label>
        <select id="cdiOrigin">
          <option value="China">China / Chine</option>
          <option value="Dubai">Dubai / Dubaï</option>
        </select>

        <label for="cdiFreight">Transport cost (USD) / Transport (USD)</label>
        <input id="cdiFreight" type="number" min="0" step="0.01" value="0">

        <label for="cdiCustoms">Customs and port charges / Douane et port</label>
        <input id="cdiCustoms" type="number" min="0" step="0.01" value="0">
        <select id="cdiCustomsCurrency">
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
        </select>

        <label for="cdiOther">Other expenses / Autres frais</label>
        <input id="cdiOther" type="number" min="0" step="0.01" value="0">
        <select id="cdiOtherCurrency">
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
        </select>
      </div>

      <div class="cdi-panel">
        <h3>3. Total costs / Coût total</h3>
        <p>Purchase total USD: <strong id="cdiPurchaseUSD">0 USD</strong></p>
        <p>Purchase total CNY: <strong id="cdiPurchaseCNY">0 CNY</strong></p>
        <p>Import costs USD: <strong id="cdiCostsUSD">0 USD</strong></p>
        <p>Import costs CNY: <strong id="cdiCostsCNY">0 CNY</strong></p>
        <p>Total USD: <strong id="cdiTotalUSD">0 USD</strong></p>
        <p>Total CNY: <strong id="cdiTotalCNY">0 CNY</strong></p>
        <p class="cdi-note">
          USD and CNY remain separate. No automatic conversion to BIF.
        </p>
      </div>

      <div class="cdi-panel">
        <h3>4. Recording / Enregistrement</h3>
        <p>Date and time in Burundi:
          <strong id="cdiCurrentTime">Not saved / Non enregistré</strong>
        </p>
        <button type="button" id="cdiSave">Save / Enregistrer</button>
        <button type="button" id="cdiPrint">Print / Imprimer</button>
        <p class="cdi-note">
          Important: records are currently kept only while this page remains
          open. Permanent Supabase storage is not connected by this file.
        </p>
      </div>

      <div class="cdi-panel">
        <h3>5. Saved records / Enregistrements</h3>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Product</th>
                <th>Origin</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Purchase total</th>
                <th>Date and time</th>
              </tr>
            </thead>
            <tbody id="cdiSavedRecords">
              <tr><td colspan="7">No records yet / Aucun enregistrement</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'cdiStyle';
    style.textContent = `
      #chinaDubaiImport { color:#172033; }
      #chinaDubaiImport .cdi-panel {
        background:#fff; border:1px solid #dbe1ea;
        border-radius:12px; padding:14px; margin:14px 0;
      }
      #chinaDubaiImport label {
        display:block; font-weight:600; margin:10px 0 5px;
      }
      #chinaDubaiImport input:not([type=file]),
      #chinaDubaiImport select {
        box-sizing:border-box; width:100%; max-width:520px;
        padding:10px; border:1px solid #cbd5e1;
        border-radius:8px; background:#fff; margin-bottom:6px;
      }
      #chinaDubaiImport button {
        background:#b91c1c; color:white; border:0;
        border-radius:8px; padding:11px 13px;
        margin:6px 4px 6px 0; cursor:pointer;
      }
      #chinaDubaiImport button:disabled { opacity:.6; }
      #chinaDubaiImport .cdi-results {
        margin-top:14px; padding:12px; background:#f1f5f9;
        border-radius:9px; overflow-wrap:anywhere;
      }
      #chinaDubaiImport .cdi-note { font-size:13px; color:#64748b; }
      #chinaDubaiImport table { border-collapse:collapse; width:100%; }
      #chinaDubaiImport th, #chinaDubaiImport td {
        text-align:left; padding:8px; border-bottom:1px solid #e2e8f0;
      }
      #chinaDubaiImport img.cdi-thumb {
        width:60px; height:60px; object-fit:cover;
      }
      @media print {
        body * { visibility:hidden !important; }
        #chinaDubaiImport, #chinaDubaiImport * { visibility:visible !important; }
        #chinaDubaiImport {
          display:block !important; position:absolute;
          left:0; top:0; width:100%; background:white;
        }
        #chinaDubaiImport button { display:none !important; }
        #chinaDubaiImport .cdi-panel { break-inside:avoid; }
      }
    `;

    document.head.appendChild(style);
    parent.appendChild(section);
    bind();
  }

  function bind() {
    const save = $('cdiSave');
    if (!save || save.dataset.bound === 'yes') return;
    save.dataset.bound = 'yes';

    [
      'cdiPerCarton', 'cdiCartons', 'cdiBasis', 'cdiCurrency',
      'cdiPrice', 'cdiFreight', 'cdiCustoms', 'cdiCustomsCurrency',
      'cdiOther', 'cdiOtherCurrency', 'cdiUnit'
    ].forEach(id => {
      $(id).addEventListener('input', calculate);
      $(id).addEventListener('change', calculate);
    });

    // Open the phone's gallery directly from a visible button.
    $('cdiGalleryButton').addEventListener('click', () => {
      $('cdiGallery').click();
    });

    // Open the camera directly from a visible button.
    $('cdiCameraButton').addEventListener('click', () => {
      $('cdiCamera').click();
    });

    $('cdiGallery').addEventListener('change', choosePhoto);
    $('cdiCamera').addEventListener('change', choosePhoto);
    $('cdiSave').addEventListener('click', saveRecord);
    $('cdiPrint').addEventListener('click', printRecords);

    calculate();
  }

  function choosePhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image / Veuillez choisir une image.');
      event.target.value = '';
      return;
    }

    // Prevent extremely large images from consuming too much phone memory.
    if (file.size > 12 * 1024 * 1024) {
      alert('Please choose a photo smaller than 12 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      activePhoto = String(reader.result || '');
      const preview = $('cdiPhotoPreview');
      preview.src = activePhoto;
      preview.style.display = 'block';
    };

    reader.onerror = () => {
      alert('Could not load this photo. Please try another image.');
    };

    reader.readAsDataURL(file);
  }

  function getCalculation() {
    const unitsPerCarton = number('cdiPerCarton');
    const cartons = number('cdiCartons');
    const quantity = unitsPerCarton * cartons;
    const basis = $('cdiBasis').value;
    const currency = $('cdiCurrency').value;
    const price = number('cdiPrice');

    const purchaseTotal = basis === 'carton'
      ? price * cartons
      : price * quantity;

    return {
      name: $('cdiName').value.trim(),
      unit: $('cdiUnit').value,
      unitsPerCarton,
      cartons,
      quantity,
      basis,
      currency,
      enteredPrice: price,
      unitPrice: quantity > 0 ? purchaseTotal / quantity : 0,
      cartonPrice: cartons > 0 ? purchaseTotal / cartons : 0,
      purchaseTotal
    };
  }

  function calculate() {
    if (!$('cdiQuantity')) return;

    const p = getCalculation();
    const unitLabels = {
      litres: 'litres',
      pieces: 'pieces',
      rolls: 'rolls',
      boxes: 'boxes',
      kg: 'kg',
      sets: 'sets',
      other: 'units'
    };

    $('cdiQuantity').textContent =
      money(p.quantity) + ' ' + unitLabels[p.unit];

    $('cdiUnitPrice').textContent =
      money(p.unitPrice) + ' ' + p.currency + ' / ' + p.unit;

    $('cdiCartonPrice').textContent =
      money(p.cartonPrice) + ' ' + p.currency;

    $('cdiProductTotal').textContent =
      money(p.purchaseTotal) + ' ' + p.currency;

    const purchase = { USD: 0, CNY: 0 };
    purchase[p.currency] = p.purchaseTotal;

    const costs = { USD: number('cdiFreight'), CNY: 0 };
    costs[$('cdiCustomsCurrency').value] += number('cdiCustoms');
    costs[$('cdiOtherCurrency').value] += number('cdiOther');

    $('cdiPurchaseUSD').textContent = money(purchase.USD) + ' USD';
    $('cdiPurchaseCNY').textContent = money(purchase.CNY) + ' CNY';
    $('cdiCostsUSD').textContent = money(costs.USD) + ' USD';
    $('cdiCostsCNY').textContent = money(costs.CNY) + ' CNY';
    $('cdiTotalUSD').textContent =
      money(purchase.USD + costs.USD) + ' USD';
    $('cdiTotalCNY').textContent =
      money(purchase.CNY + costs.CNY) + ' CNY';
  }

  function saveRecord() {
    const p = getCalculation();

    if (!p.name) {
      alert('Enter the product name first / Entrez le nom du produit.');
      $('cdiName').focus();
      return;
    }

    const record = {
      ...p,
      photo: activePhoto,
      supplier: $('cdiSupplier').value.trim(),
      origin: $('cdiOrigin').value,
      freightUSD: number('cdiFreight'),
      customs: number('cdiCustoms'),
      customsCurrency: $('cdiCustomsCurrency').value,
      other: number('cdiOther'),
      otherCurrency: $('cdiOtherCurrency').value,
      recordedAt: localDateTime()
    };

    records.push(record);
    $('cdiCurrentTime').textContent = record.recordedAt;
    renderRecords();

    alert(
      'Record added to this open session. Permanent database saving is not connected yet.'
    );
  }

  function renderRecords() {
    $('cdiSavedRecords').innerHTML = records.map(record => `
      <tr>
        <td>${record.photo
          ? `<img class="cdi-thumb" src="${record.photo}" alt="Product photo">`
          : 'No photo'}</td>
        <td>${safe(record.name)}</td>
        <td>${safe(record.origin)}</td>
        <td>${money(record.quantity)} ${safe(record.unit)}</td>
        <td>${money(record.unitPrice)} ${safe(record.currency)}</td>
        <td>${money(record.purchaseTotal)} ${safe(record.currency)}</td>
        <td>${safe(record.recordedAt)}</td>
      </tr>
    `).join('') || `
      <tr><td colspan="7">No records yet / Aucun enregistrement</td></tr>
    `;
  }

  function printRecords() {
    // Do not ask for the product name again just to print.
    // If the user has not saved yet, show the current Burundi time.
    if ($('cdiCurrentTime').textContent.includes('Not saved')
        || $('cdiCurrentTime').textContent.includes('Non enregistré')) {
      $('cdiCurrentTime').textContent =
        localDateTime() + ' (print time / heure d’impression)';
    }

    window.print();
  }

  window.cwbInitChinaDubaiImport = initialize;
  window.cwbChinaDubaiCalculate = calculate;

})();
