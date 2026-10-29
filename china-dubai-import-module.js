/* C.W.B System — China & Dubai Import */
(function () {
  'use strict';

  const ID = 'chinaDubaiImport';
  const TABLE = 'cwb_china_dubai_imports';
  const BUCKET = 'cwb-china-dubai-photos';
  const CUSTOMS_TABLE = 'cwb_china_dubai_customs_documents';
  const CUSTOMS_BUCKET = 'cwb-china-dubai-customs';

  let photoFile = null;
  let bound = false;
  let customsImport = null;

  const $ = id => document.getElementById(id);

  const num = id => {
    const v = Number($(id)?.value || 0);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  const fmt = v => Number(v || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2
  });

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  const db = () =>
    window.cwbSupabaseClient || window.supabaseClient || null;

  function burundiTime(value) {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Africa/Bujumbura',
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date(value));
    } catch (_) {
      return String(value || '—');
    }
  }

  function message(text, error = false) {
    const el = $('cdiMessage');
    if (el) {
      el.textContent = text;
      el.style.color = error ? '#b91c1c' : '#166534';
    }
  }

  function init() {
    if ($(ID)) {
      bind();
      load();
      return;
    }

    const parent =
      document.querySelector('.container') ||
      document.querySelector('main') ||
      document.body;

    const section = document.createElement('section');
    section.id = ID;
    section.className = 'card hidden';

    section.innerHTML = `
      <h2>C.W.B China &amp; Dubai Import</h2>
      <p><b>Camel Work and Business company</b></p>
      <p>Better Quality is our priority</p>

      <div class="cdi-panel">
        <h3>1. Produit / Product</h3>

        <label>Nom du produit *</label>
        <input id="cdiName" placeholder="Nom réel du produit">

        <label>Catégorie</label>
        <input id="cdiCategory"
          placeholder="Peinture, pièces, accessoires...">

        <label>Fournisseur</label>
        <input id="cdiSupplier">

        <label>Référence fournisseur</label>
        <input id="cdiRef">

        <label>Photo du produit</label>
        <button type="button" id="cdiGalleryBtn">
          📁 Choisir dans la galerie
        </button>
        <button type="button" id="cdiCameraBtn">
          📷 Prendre une photo
        </button>

        <input id="cdiGallery" type="file"
          accept="image/*" hidden>
        <input id="cdiCamera" type="file"
          accept="image/*" capture="environment" hidden>

        <img id="cdiPreview" alt="Photo du produit"
          style="display:none;max-width:220px;max-height:220px;object-fit:contain">

        <div class="cdi-grid">
          <div>
            <label>Pays d'origine</label>
            <select id="cdiOrigin">
              <option value="China">China / Chine</option>
              <option value="Dubai">Dubai / Dubaï</option>
            </select>
          </div>

          <div>
            <label>Unité</label>
            <select id="cdiUnit">
              <option value="pieces">Pièces</option>
              <option value="litres">Litres</option>
              <option value="rolls">Rouleaux</option>
              <option value="boxes">Boîtes</option>
              <option value="kg">Kilogrammes</option>
              <option value="sets">Ensembles</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div>
            <label>Nombre de cartons</label>
            <input id="cdiCartons" type="number"
              min="0" step="1" value="0">
          </div>

          <div>
            <label>Unités par carton</label>
            <input id="cdiPerCarton" type="number"
              min="1" step="1" value="1">
          </div>

          <div>
            <label>Prix saisi pour</label>
            <select id="cdiBasis">
              <option value="unit">Une unité</option>
              <option value="carton">Un carton</option>
            </select>
          </div>

          <div>
            <label>Devise d'achat</label>
            <select id="cdiCurrency">
              <option>USD</option>
              <option>CNY</option>
              <option>AED</option>
              <option>BIF</option>
              <option>EUR</option>
            </select>
          </div>

          <div>
            <label>Prix saisi</label>
            <input id="cdiPrice" type="number"
              min="0" step="0.0001" value="0">
          </div>

          <div>
            <label>Taux de change vers BIF</label>
            <input id="cdiRate" type="number"
              min="0.0001" step="0.0001" value="1">
            <small>Pour BIF, le taux est 1. Pour les autres devises,
              entrez le taux de conversion actuel.</small>
          </div>
        </div>

        <div class="cdi-results">
          <p>Quantité totale : <b id="cdiQty">0</b></p>
          <p>Prix d'achat par unité : <b id="cdiUnitPrice">0</b></p>
          <p>Prix d'achat par carton : <b id="cdiCartonPrice">0</b></p>
          <p>Total d'achat : <b id="cdiPurchase">0</b></p>
          <p>Coût d'achat converti en BIF :
            <b id="cdiPurchaseBif">0 BIF</b></p>
        </div>
      </div>

      <div class="cdi-panel">
        <h3>2. Frais d'importation (BIF)</h3>

        <div class="cdi-grid">
          <div>
            <label>Transport (BIF)</label>
            <input id="cdiFreight" type="number" min="0" value="0">
          </div>

          <div>
            <label>Douane, port et taxes (BIF)</label>
            <input id="cdiCustoms" type="number" min="0" value="0">
          </div>

          <div>
            <label>Autres frais (BIF)</label>
            <input id="cdiOther" type="number" min="0" value="0">
          </div>

          <div>
            <label>Prix de vente unitaire TTC (BIF)</label>
            <input id="cdiSelling" type="number" min="0" value="0">
          </div>

          <div>
            <label>Statut de l'importation</label>
            <select id="cdiStatus">
              <option>Planned</option>
              <option>Ordered</option>
              <option>In Transit</option>
              <option>Arrived</option>
              <option>Cancelled</option>
            </select>
          </div>
        </div>

        <label>Notes / Remarques</label>
        <textarea id="cdiNotes" rows="3"></textarea>
      </div>

      <div class="cdi-panel">
        <h3>3. Coûts, TVA et bénéfice estimé</h3>
        <p>Transport : <b id="cdiShowFreight">0 BIF</b></p>
        <p>Douane/port/taxes : <b id="cdiShowCustoms">0 BIF</b></p>
        <p>Autres frais : <b id="cdiShowOther">0 BIF</b></p>
        <p>Coût total d'importation :
          <b id="cdiLanded">0 BIF</b></p>
        <p>Coût par unité : <b id="cdiCostUnit">0 BIF</b></p>
        <p>Chiffre d'affaires TTC prévu :
          <b id="cdiRevenue">0 BIF</b></p>
        <p>TVA estimée incluse (18/118) :
          <b id="cdiVat">0 BIF</b></p>
        <p>Bénéfice estimé après TVA calculée :
          <b id="cdiProfit">0 BIF</b></p>
        <p class="cdi-note">
          Estimation de gestion uniquement. Confirmez le traitement
          fiscal applicable au Burundi avec un professionnel.
        </p>
      </div>

      <div class="cdi-panel">
        <h3>4. Enregistrement</h3>
        <p>Date et heure au Burundi : <b id="cdiTime">—</b></p>
        <button type="button" id="cdiSave">
          Enregistrer dans Supabase
        </button>
        <button type="button" id="cdiRefresh">Actualiser</button>
        <button type="button" id="cdiPrint">Imprimer</button>
        <p id="cdiMessage" role="status" class="cdi-note"></p>
      </div>

      <div class="cdi-panel">
        <h3>5. Dossier de douane</h3>

        <p>
          Le numéro d'importation est généré automatiquement
          par Supabase lors de l'enregistrement.
        </p>

        <label>Numéro d'importation</label>
        <input id="cdiCustomsNumber"
          placeholder="Ex. CDI-2026-0001">

        <button type="button" id="cdiCustomsSearch">
          Rechercher le dossier
        </button>

        <p id="cdiCustomsResult" role="status" class="cdi-note">
          Entrez le numéro d'importation pour rechercher son dossier.
        </p>

        <label>Documents de douane (PDF ou images, 20 Mo maximum par fichier)</label>
        <input id="cdiCustomsFiles" type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple>

        <button type="button" id="cdiCustomsUpload" disabled>
          Enregistrer les documents
        </button>

        <div id="cdiCustomsDocuments"></div>
      </div>

      <div class="cdi-panel">
        <h3>6. Produits enregistrés</h3>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>N° importation</th>
                <th>Photo</th>
                <th>Produit</th>
                <th>Pays</th>
                <th>Cartons</th>
                <th>Unités/carton</th>
                <th>Unité</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Coût total BIF</th>
                <th>Vente/unité TTC</th>
                <th>Bénéfice DB*</th>
                <th>Statut</th>
                <th>Stock</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody id="cdiRows">
              <tr><td colspan="15">Chargement…</td></tr>
            </tbody>
          </table>
        </div>
        <p class="cdi-note">
          *Le bénéfice de la base de données ne déduit pas la TVA estimée.
        </p>
      </div>
    `;

    if (!$('cdiStyle')) {
      const style = document.createElement('style');
      style.id = 'cdiStyle';
      style.textContent = `
        #chinaDubaiImport { color:#172033; }

        #chinaDubaiImport .cdi-receive-btn {
          background:#166534;color:#fff;white-space:normal;
          min-width:150px;padding:8px;border:0;border-radius:7px;
        }

        #chinaDubaiImport .cdi-receive-btn:disabled {
          opacity:.6;cursor:wait;
        }

        #chinaDubaiImport .cdi-panel {
          background:#fff;border:1px solid #dbe1ea;
          border-radius:12px;padding:14px;margin:14px 0;
        }

        #chinaDubaiImport label {
          display:block;font-weight:600;margin:10px 0 5px;
        }

        #chinaDubaiImport input:not([type=file]),
        #chinaDubaiImport select,
        #chinaDubaiImport textarea {
          box-sizing:border-box;width:100%;padding:10px;
          border:1px solid #cbd5e1;border-radius:8px;margin-bottom:6px;
        }

        #chinaDubaiImport .cdi-grid {
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
          gap:10px;
        }

        #chinaDubaiImport button {
          background:#b91c1c;color:white;border:0;border-radius:8px;
          padding:11px 13px;margin:6px 4px 6px 0;
        }

        #chinaDubaiImport button:disabled { opacity:.6; }

        #chinaDubaiImport .cdi-results {
          background:#f1f5f9;padding:12px;border-radius:9px;
          overflow-wrap:anywhere;
        }

        #chinaDubaiImport .cdi-note {
          font-size:13px;color:#64748b;
        }

        #chinaDubaiImport table {
          border-collapse:collapse;width:100%;min-width:1200px;
        }

        #chinaDubaiImport th,#chinaDubaiImport td {
          padding:8px;border-bottom:1px solid #e2e8f0;
          font-size:12px;text-align:left;
        }

        #chinaDubaiImport th { background:#111827;color:white; }

        #chinaDubaiImport .cdi-thumb {
          width:54px;height:54px;object-fit:cover;
        }

        #chinaDubaiImport .cdi-document {
          overflow-wrap:anywhere;margin:8px 0;
        }

        @media print {
          body * { visibility:hidden!important; }

          #chinaDubaiImport,#chinaDubaiImport * {
            visibility:visible!important;
          }

          #chinaDubaiImport {
            display:block!important;position:absolute;
            left:0;top:0;width:100%;
          }

          #chinaDubaiImport button,
          #chinaDubaiImport input[type=file] {
            display:none!important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    parent.appendChild(section);
    bind();
    load();
  }

  function bind() {
    if (bound || !$('cdiSave')) return;
    bound = true;

    [
      'cdiCartons', 'cdiPerCarton', 'cdiBasis', 'cdiCurrency',
      'cdiPrice', 'cdiRate', 'cdiFreight', 'cdiCustoms',
      'cdiOther', 'cdiSelling', 'cdiUnit'
    ].forEach(id => {
      $(id).addEventListener('input', calculate);
      $(id).addEventListener('change', calculate);
    });

    $('cdiCurrency').addEventListener('change', () => {
      if ($('cdiCurrency').value === 'BIF') {
        $('cdiRate').value = '1';
      }
      calculate();
    });

    $('cdiGalleryBtn').addEventListener('click',
      () => $('cdiGallery').click());

    $('cdiCameraBtn').addEventListener('click',
      () => $('cdiCamera').click());

    $('cdiGallery').addEventListener('change', photoChosen);
    $('cdiCamera').addEventListener('change', photoChosen);
    $('cdiSave').addEventListener('click', save);
    $('cdiRefresh').addEventListener('click', load);
    $('cdiPrint').addEventListener('click', () => window.print());

    $('cdiCustomsSearch').addEventListener(
      'click', searchCustomsImport
    );

    $('cdiCustomsUpload').addEventListener(
      'click', uploadCustomsDocuments
    );

    $('cdiCustomsNumber').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchCustomsImport();
      }
    });

    calculate();
  }

  function photoChosen(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      message('Choisissez un fichier image.', true);
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      message('La photo doit faire 5 Mo ou moins.', true);
      event.target.value = '';
      return;
    }

    photoFile = file;
    const reader = new FileReader();

    reader.onload = () => {
      $('cdiPreview').src = String(reader.result || '');
      $('cdiPreview').style.display = 'block';
    };

    reader.onerror = () =>
      message('Impossible de lire la photo.', true);

    reader.readAsDataURL(file);
  }

  function getCalculation() {
    const cartons = Math.floor(num('cdiCartons'));
    const per = Math.max(1, Math.floor(num('cdiPerCarton') || 1));
    const quantity = cartons * per;
    const currency = $('cdiCurrency').value;
    const rate = currency === 'BIF' ? 1 : num('cdiRate');
    const enteredPrice = num('cdiPrice');

    const unitPrice = $('cdiBasis').value === 'carton'
      ? enteredPrice / per
      : enteredPrice;

    const cartonPrice = unitPrice * per;
    const purchaseTotal = unitPrice * quantity;
    const purchaseBif = purchaseTotal * rate;
    const freight = num('cdiFreight');
    const customs = num('cdiCustoms');
    const other = num('cdiOther');
    const landed = purchaseBif + freight + customs + other;
    const selling = num('cdiSelling');
    const revenue = quantity * selling;
    const vat = revenue * 18 / 118;

    return {
      cartons, per, quantity, currency, rate, unitPrice,
      cartonPrice, purchaseTotal, purchaseBif, freight,
      customs, other, landed, selling, revenue, vat,
      profit: revenue - vat - landed
    };
  }

  function calculate() {
    if (!$('cdiQty')) return;

    const x = getCalculation();
    const unit = $('cdiUnit').value;

    $('cdiQty').textContent = fmt(x.quantity) + ' ' + unit;
    $('cdiUnitPrice').textContent =
      fmt(x.unitPrice) + ' ' + x.currency + ' / unité';
    $('cdiCartonPrice').textContent =
      fmt(x.cartonPrice) + ' ' + x.currency;
    $('cdiPurchase').textContent =
      fmt(x.purchaseTotal) + ' ' + x.currency;
    $('cdiPurchaseBif').textContent = fmt(x.purchaseBif) + ' BIF';

    $('cdiShowFreight').textContent = fmt(x.freight) + ' BIF';
    $('cdiShowCustoms').textContent = fmt(x.customs) + ' BIF';
    $('cdiShowOther').textContent = fmt(x.other) + ' BIF';
    $('cdiLanded').textContent = fmt(x.landed) + ' BIF';
    $('cdiCostUnit').textContent =
      fmt(x.quantity ? x.landed / x.quantity : 0) + ' BIF';
    $('cdiRevenue').textContent = fmt(x.revenue) + ' BIF';
    $('cdiVat').textContent = fmt(x.vat) + ' BIF';
    $('cdiProfit').textContent = fmt(x.profit) + ' BIF';
  }

  async function save() {
    const client = db();

    if (!client) {
      message('Connexion Supabase introuvable. Rechargez le système.', true);
      return;
    }

    const name = $('cdiName').value.trim();

    if (!name) {
      message('Entrez le nom du produit.', true);
      $('cdiName').focus();
      return;
    }

    const rawCartons = Number($('cdiCartons').value || 0);
    const rawPer = Number($('cdiPerCarton').value || 1);
    const x = getCalculation();

    if (!Number.isInteger(rawCartons) || rawCartons < 0 ||
        !Number.isInteger(rawPer) || rawPer < 1 || x.rate <= 0) {
      message(
        'Vérifiez les cartons, les unités par carton et le taux de change.',
        true
      );
      return;
    }

    const auth = await client.auth.getUser();
    const user = auth.data && auth.data.user;

    if (auth.error || !user) {
      message('Connectez-vous à C.W.B System avant de sauvegarder.', true);
      return;
    }

    const button = $('cdiSave');
    button.disabled = true;
    message('Enregistrement en cours…');

    let uploadedPath = null;

    try {
      if (photoFile) {
        const safeName = photoFile.name
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(-90);

        uploadedPath = user.id + '/' + Date.now() + '-' + safeName;

        const upload = await client.storage.from(BUCKET).upload(
          uploadedPath,
          photoFile,
          {
            cacheControl: '3600',
            upsert: false,
            contentType: photoFile.type
          }
        );

        if (upload.error) {
          throw new Error(
            'Photo non enregistrée : ' + upload.error.message
          );
        }
      }

      /*
       * Les colonnes calculées restent générées par Supabase.
       * Le numéro d'importation est généré par le trigger SQL.
       */
      const row = {
        item_name: name,
        unit: $('cdiUnit').value,
        category: $('cdiCategory').value.trim() || null,
        source_country: $('cdiOrigin').value,
        supplier_name: $('cdiSupplier').value.trim() || null,
        supplier_reference: $('cdiRef').value.trim() || null,
        carton_quantity: x.cartons,
        pieces_per_carton: x.per,
        purchase_currency: x.currency,
        purchase_unit_price: Number(x.unitPrice.toFixed(2)),
        exchange_rate_to_bif: x.rate,
        transport_cost_bif: x.freight,
        customs_cost_bif: x.customs,
        other_costs_bif: x.other,
        selling_price_per_piece_bif: x.selling,
        photo_path: uploadedPath,
        import_status: $('cdiStatus').value,
        notes: $('cdiNotes').value.trim() || null
      };

      const result = await client.from(TABLE)
        .insert([row])
        .select('id, import_number')
        .single();

      if (result.error) {
        if (uploadedPath) {
          await client.storage.from(BUCKET).remove([uploadedPath]);
        }
        throw new Error('Supabase : ' + result.error.message);
      }

      $('cdiTime').textContent =
        burundiTime(new Date().toISOString());

      photoFile = null;
      $('cdiGallery').value = '';
      $('cdiCamera').value = '';
      $('cdiPreview').removeAttribute('src');
      $('cdiPreview').style.display = 'none';

      if (result.data && result.data.import_number) {
        $('cdiCustomsNumber').value = result.data.import_number;
      }

      message(
        'Importation enregistrée. Numéro : ' +
        (result.data?.import_number || 'recherche nécessaire')
      );

      await load();

    } catch (error) {
      message(
        error && error.message
          ? error.message
          : 'Erreur pendant la sauvegarde.',
        true
      );
    } finally {
      button.disabled = false;
    }
  }

  async function load() {
    const body = $('cdiRows');
    if (!body) return;

    const client = db();

    if (!client) {
      body.innerHTML =
        '<tr><td colspan="15">Connexion Supabase indisponible.</td></tr>';
      return;
    }

    body.innerHTML =
      '<tr><td colspan="15">Chargement…</td></tr>';

    try {
      const result = await client.from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (result.error) {
        body.innerHTML =
          '<tr><td colspan="15">Erreur Supabase : ' +
          esc(result.error.message) + '</td></tr>';
        return;
      }

      if (!result.data || !result.data.length) {
        body.innerHTML =
          '<tr><td colspan="15">Aucun produit enregistré.</td></tr>';
        return;
      }

      const auth = await client.auth.getUser();
      const uid = auth.data && auth.data.user
        ? auth.data.user.id
        : '';

      const rows = await Promise.all(result.data.map(async item => {
        let image = '—';

        if (item.photo_path && uid) {
          const signed = await client.storage.from(BUCKET)
            .createSignedUrl(item.photo_path, 3600);

          if (signed.data && signed.data.signedUrl) {
            image = '<img class="cdi-thumb" src="' +
              esc(signed.data.signedUrl) +
              '" alt="Photo produit">';
          }
        }

        return '<tr>' +
          '<td>' +
            '<button type="button" class="cdi-number-btn" data-number="' +
            esc(item.import_number || '') + '">' +
            esc(item.import_number || '—') +
            '</button>' +
          '</td>' +
          '<td>' + image + '</td>' +
          '<td>' + esc(item.item_name) + '</td>' +
          '<td>' + esc(item.source_country) + '</td>' +
          '<td>' + fmt(item.carton_quantity) + '</td>' +
          '<td>' + fmt(item.pieces_per_carton) + '</td>' +
          '<td>' + esc(item.unit || 'pieces') + '</td>' +
          '<td>' + fmt(item.total_pieces) + '</td>' +
          '<td>' + fmt(item.purchase_unit_price) + ' ' +
            esc(item.purchase_currency) + '</td>' +
          '<td>' + fmt(item.landed_cost_bif) + ' BIF</td>' +
          '<td>' + fmt(item.selling_price_per_piece_bif) + ' BIF</td>' +
          '<td>' + fmt(item.expected_profit_bif) + ' BIF</td>' +
          '<td>' + esc(item.import_status) + '</td>' +
          '<td>' + (
            item.stock_received_at
              ? 'Stock ajouté'
              : item.import_status === 'Arrived'
                ? '<button type="button" class="cdi-receive-btn" data-id="' +
                  esc(item.id) + '">Confirmer la réception</button>'
                : '—'
          ) + '</td>' +
          '<td>' + esc(burundiTime(item.created_at)) + '</td>' +
          '</tr>';
      }));

      body.innerHTML = rows.join('');

      body.querySelectorAll('.cdi-receive-btn').forEach(button => {
        button.addEventListener('click', async () => {
          const importId = button.dataset.id;
          if (!importId) return;

          const accepted = window.confirm(
            'Confirmer que les marchandises sont physiquement arrivées ? ' +
            'Cette action ajoutera la quantité à l’inventaire une seule fois.'
          );
          if (!accepted) return;

          button.disabled = true;

          try {
            const receipt = await client.rpc('cwb_cd_confirm_receipt', {
              p_import_id: importId
            });

            if (receipt.error) throw receipt.error;

            const result = receipt.data;

            if (!result || result.success !== true) {
              throw new Error(
                result && result.message
                  ? result.message
                  : 'La base de données n’a pas confirmé la réception.'
              );
            }

            message(
              'Réception confirmée : ' + fmt(result.quantity_added) +
              ' ' + (result.unit || '') +
              ' ajouté(s) au stock. Coût rendu/unité : ' +
              fmt(result.unit_landed_cost_bif) + ' BIF.'
            );

            await load();

          } catch (error) {
            message(
              'Réception non effectuée : ' +
              (error.message || 'erreur inconnue'),
              true
            );
            button.disabled = false;
          }
        });
      });

      body.querySelectorAll('.cdi-number-btn').forEach(button => {
        button.addEventListener('click', () => {
          const number = button.dataset.number || '';
          if (!number || number === '—') return;

          $('cdiCustomsNumber').value = number;
          searchCustomsImport();

          $('cdiCustomsNumber').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        });
      });

    } catch (error) {
      body.innerHTML =
        '<tr><td colspan="15">Erreur : ' +
        esc(error.message || 'Chargement impossible') +
        '</td></tr>';
    }
  }

  async function searchCustomsImport() {
    const client = db();
    const input = $('cdiCustomsNumber');
    const number = input.value.trim().toUpperCase();

    customsImport = null;
    $('cdiCustomsUpload').disabled = true;
    $('cdiCustomsDocuments').textContent = '';

    if (!client) {
      $('cdiCustomsResult').textContent =
        'Connexion Supabase indisponible.';
      return;
    }

    if (!number) {
      $('cdiCustomsResult').textContent =
        'Entrez le numéro d’importation.';
      return;
    }

    $('cdiCustomsResult').textContent = 'Recherche en cours…';

    try {
      const result = await client.from(TABLE)
        .select('id, import_number, item_name, source_country')
        .eq('import_number', number)
        .maybeSingle();

      if (result.error) throw result.error;

      if (!result.data) {
        $('cdiCustomsResult').textContent =
          'Aucune importation trouvée avec ce numéro.';
        return;
      }

      customsImport = result.data;
      $('cdiCustomsUpload').disabled = false;

      $('cdiCustomsResult').textContent =
        'Importation : ' + customsImport.import_number +
        ' — Produit : ' + customsImport.item_name +
        ' — Origine : ' + customsImport.source_country;

      await loadCustomsDocuments();

    } catch (error) {
      $('cdiCustomsResult').textContent =
        'Erreur : ' + (error.message || 'Recherche impossible');
    }
  }

  async function loadCustomsDocuments() {
    const client = db();
    const container = $('cdiCustomsDocuments');

    if (!client || !customsImport) return;

    container.textContent = 'Chargement des documents…';

    const result = await client
      .from(CUSTOMS_TABLE)
      .select('id, document_path, original_name, created_at')
      .eq('import_id', customsImport.id)
      .order('created_at', { ascending: false });

    if (result.error) {
      container.textContent =
        'Impossible de charger les documents : ' +
        result.error.message;
      return;
    }

    container.replaceChildren();

    if (!result.data || !result.data.length) {
      container.textContent =
        'Aucun document de douane enregistré.';
      return;
    }

    for (const doc of result.data) {
      const line = document.createElement('p');
      line.className = 'cdi-document';

      const link = document.createElement('a');
      link.href = '#';
      link.textContent =
        doc.original_name + ' — ' + burundiTime(doc.created_at);

      link.addEventListener('click', async event => {
        event.preventDefault();

        const signed = await client.storage
          .from(CUSTOMS_BUCKET)
          .createSignedUrl(doc.document_path, 300);

        if (signed.error || !signed.data?.signedUrl) {
          message('Impossible d’ouvrir le document.', true);
          return;
        }

        window.open(
          signed.data.signedUrl,
          '_blank',
          'noopener'
        );
      });

      line.appendChild(link);
      container.appendChild(line);
    }
  }

  async function uploadCustomsDocuments() {
    const client = db();
    const input = $('cdiCustomsFiles');
    const files = Array.from(input.files || []);
    const button = $('cdiCustomsUpload');

    if (!client || !customsImport) {
      message('Recherchez d’abord une importation valide.', true);
      return;
    }

    if (!files.length) {
      message('Choisissez au moins un document.', true);
      return;
    }

    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    for (const file of files) {
      if (!allowed.includes(file.type) ||
          file.size > 20 * 1024 * 1024) {
        message(
          'Chaque fichier doit être un PDF ou une image autorisée de 20 Mo maximum.',
          true
        );
        return;
      }
    }

    const auth = await client.auth.getUser();
    const user = auth.data && auth.data.user;

    if (auth.error || !user) {
      message('Connectez-vous avant d’enregistrer les documents.', true);
      return;
    }

    button.disabled = true;
    let saved = 0;

    try {
      for (const file of files) {
        const safeName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .slice(-100);

        const path = user.id + '/' + customsImport.id + '/' +
          Date.now() + '-' + safeName;

        const upload = await client.storage
          .from(CUSTOMS_BUCKET)
          .upload(path, file, {
            upsert: false,
            contentType: file.type
          });

        if (upload.error) throw upload.error;

        const savedDoc = await client
          .from(CUSTOMS_TABLE)
          .insert({
            import_id: customsImport.id,
            document_path: path,
            original_name: file.name,
            uploaded_by: user.id
          });

        if (savedDoc.error) {
          await client.storage
            .from(CUSTOMS_BUCKET)
            .remove([path]);

          throw savedDoc.error;
        }

        saved++;
      }

      message(saved + ' document(s) de douane enregistré(s).');
      input.value = '';

      await loadCustomsDocuments();

    } catch (error) {
      message(
        'Erreur pendant l’enregistrement : ' +
        (error.message || 'erreur inconnue'),
        true
      );
    } finally {
      button.disabled = false;
    }
  }

  window.cwbInitChinaDubaiImport = init;
  window.cwbChinaDubaiCalculate = calculate;
})();
