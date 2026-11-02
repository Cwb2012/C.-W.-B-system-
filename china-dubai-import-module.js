/* C.W.B System — China & Dubai Import
   Rebuilt module. Keeps existing Supabase tables, buckets and receipt RPC.
*/
(function () {
  'use strict';

  const ID = 'chinaDubaiImport';
  const TABLE = 'cwb_china_dubai_imports';
  const CUSTOMS_TABLE = 'cwb_china_dubai_customs_documents';
  const PHOTO_BUCKET = 'cwb-china-dubai-photos';
  const CUSTOMS_BUCKET = 'cwb-china-dubai-customs';
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
  const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;

  let initialized = false;
  let photoFile = null;
  let customsImport = null;

  const $ = (id) => document.getElementById(id);
  const db = () => window.cwbSupabaseClient || window.supabaseClient || window.supabase || null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function number(id) {
    const value = Number($(id) && $(id).value);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function money(value) {
    return Number(value || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function showMessage(text, isError) {
    const node = $('cdiMessage');
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? '#b42318' : '#18794e';
  }

  function requireDb() {
    const client = db();
    if (!client) throw new Error('Connexion Supabase introuvable. Vérifiez le client Supabase dans index.html.');
    return client;
  }

  function getCalculation() {
    const cartons = number('cdiCartons');
    const perCarton = number('cdiPerCarton');
    const total = cartons * perCarton;
    const purchase = number('cdiPurchasePrice');
    const transport = number('cdiTransport');
    const customs = number('cdiCustomsCost');
    const other = number('cdiOther');
    const purchaseTotal = purchase * total;
    const landed = purchaseTotal + transport + customs + other;
    const retail = number('cdiRetail');
    const wholesale = number('cdiWholesale');
    const revenue = retail * total;
    const profit = revenue - landed;
    const vatIncluded = retail > 0 ? revenue * 18 / 118 : 0;

    return {
      cartons,
      perCarton,
      total,
      purchase,
      purchaseTotal,
      transport,
      customs,
      other,
      landed,
      retail,
      wholesale,
      revenue,
      profit,
      vatIncluded
    };
  }

  function calculate() {
    const c = getCalculation();
    const set = (id, value) => {
      if ($(id)) $(id).textContent = money(value);
    };

    set('cdiTotalPieces', c.total);
    set('cdiPurchaseTotal', c.purchaseTotal);
    set('cdiLandedTotal', c.landed);
    set('cdiUnitCost', c.total ? c.landed / c.total : 0);
    set('cdiExpectedRevenue', c.revenue);
    set('cdiExpectedProfit', c.profit);
    set('cdiVatEstimate', c.vatIncluded);
  }  function buildPanel() {
    if ($(ID)) return $(ID);

    const panel = document.createElement('section');
    panel.id = ID;
    panel.className = 'card hidden';

    panel.innerHTML = `
      <style>
        #${ID} .cdi-grid {
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
          gap:12px;
        }
        #${ID} .cdi-field {
          display:flex;
          flex-direction:column;
          gap:5px;
          min-width:0;
        }
        #${ID} input,
        #${ID} select,
        #${ID} textarea {
          box-sizing:border-box;
          width:100%;
          padding:10px;
          border:1px solid #cbd5e1;
          border-radius:7px;
          background:var(--input-bg,#fff);
          color:inherit;
        }
        #${ID} label {
          font-weight:600;
          font-size:13px;
        }
        #${ID} .cdi-actions {
          display:flex;
          flex-wrap:wrap;
          gap:9px;
          margin:14px 0;
        }
        #${ID} button {
          padding:10px 14px;
          border:0;
          border-radius:7px;
          cursor:pointer;
        }
        #${ID} .cdi-primary {
          background:#166534;
          color:white;
        }
        #${ID} .cdi-secondary {
          background:#e2e8f0;
          color:#172033;
        }
        #${ID} .cdi-box {
          border:1px solid #d8dee8;
          border-radius:9px;
          padding:14px;
          margin:14px 0;
        }
        #${ID} .cdi-results {
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
          gap:10px;
        }
        #${ID} .cdi-result {
          background:var(--card-bg,#f5f7fa);
          border-radius:8px;
          padding:10px;
        }
        #${ID} .cdi-result strong {
          display:block;
          margin-top:5px;
        }
        #${ID} .cdi-table-wrap {
          overflow-x:auto;
        }
        #${ID} table {
          border-collapse:collapse;
          width:100%;
          min-width:950px;
        }
        #${ID} th,
        #${ID} td {
          border-bottom:1px solid #d8dee8;
          padding:9px;
          text-align:left;
          font-size:13px;
          vertical-align:top;
        }
        #${ID} .cdi-muted {
          opacity:.75;
          font-size:13px;
        }
        #${ID} .cdi-photo-preview {
          max-width:150px;
          max-height:120px;
          object-fit:contain;
          display:none;
          margin-top:8px;
        }
      </style>

      <h2>China &amp; Dubai Import</h2>
      <p class="cdi-muted">
        Gestion des importations, des documents de douane et de la réception en stock.
      </p>

      <div id="cdiMessage" role="status" aria-live="polite"></div>

      <div class="cdi-box">
        <h3>1. Nouvelle importation</h3>

        <div class="cdi-grid">
          <div class="cdi-field">
            <label for="cdiItem">Nom du produit *</label>
            <input id="cdiItem" required>
          </div>

          <div class="cdi-field">
            <label for="cdiCategory">Catégorie</label>
            <input id="cdiCategory">
          </div>

          <div class="cdi-field">
            <label for="cdiCountry">Pays d'origine</label>
            <select id="cdiCountry">
              <option value="China">China</option>
              <option value="Dubai">Dubai</option>
              <option value="United Arab Emirates">United Arab Emirates</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="cdi-field">
            <label for="cdiSupplier">Fournisseur</label>
            <input id="cdiSupplier">
          </div>

          <div class="cdi-field">
            <label for="cdiReference">Référence fournisseur</label>
            <input id="cdiReference">
          </div>

          <div class="cdi-field">
            <label for="cdiUnit">Unité *</label>
            <select id="cdiUnit">
              <option value="pieces">Pièces</option>
              <option value="litres">Litres</option>
              <option value="rolls">Rouleaux</option>
              <option value="boxes">Boîtes</option>
              <option value="kg">Kg</option>
              <option value="sets">Sets</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div class="cdi-field">
            <label for="cdiCartons">Nombre de cartons / lots *</label>
            <input id="cdiCartons" type="number" min="1" step="1" value="1">
          </div>

          <div class="cdi-field">
            <label for="cdiPerCarton">Unités par carton / lot *</label>
            <input id="cdiPerCarton" type="number" min="1" step="1" value="1">
          </div>

          <div class="cdi-field">
            <label for="cdiPurchasePrice">Prix d'achat par unité (BIF) *</label>
            <input id="cdiPurchasePrice" type="number" min="0" step="any">
          </div>

          <div class="cdi-field">
            <label for="cdiPhoto">Photo du produit (JPG, PNG, WebP — 5 MB max.)</label>
            <input id="cdiPhoto" type="file" accept="image/jpeg,image/png,image/webp">
            <img id="cdiPhotoPreview" class="cdi-photo-preview" alt="Aperçu de la photo">
          </div>
        </div>
      </div>

      <div class="cdi-box">
        <h3>2. Frais et prix de vente (BIF)</h3>

        <p class="cdi-muted">
          Saisissez directement les montants en BIF après votre conversion bancaire.
          Le système ne convertit pas automatiquement les devises.
        </p>

        <div class="cdi-grid">
          <div class="cdi-field">
            <label for="cdiTransport">Transport total (BIF)</label>
            <input id="cdiTransport" type="number" min="0" step="any" value="0">
          </div>

          <div class="cdi-field">
            <label for="cdiCustomsCost">Douane totale (BIF)</label>
            <input id="cdiCustomsCost" type="number" min="0" step="any" value="0">
          </div>

          <div class="cdi-field">
            <label for="cdiOther">Autres frais (BIF)</label>
            <input id="cdiOther" type="number" min="0" step="any" value="0">
          </div>

          <div class="cdi-field">
            <label for="cdiRetail">Prix de détail TTC par unité (BIF)</label>
            <input id="cdiRetail" type="number" min="0" step="any">
          </div>

          <div class="cdi-field">
            <label for="cdiWholesale">Prix de gros TTC par unité (BIF)</label>
            <input id="cdiWholesale" type="number" min="0" step="any">
          </div>

          <div class="cdi-field">
            <label for="cdiStatus">Statut</label>
            <select id="cdiStatus">
              <option>Planned</option>
              <option>Ordered</option>
              <option>In Transit</option>
              <option>Arrived</option>
              <option>Cancelled</option>
            </select>
          </div>
        </div>

        <div class="cdi-field" style="margin-top:12px">
          <label for="cdiNotes">Notes</label>
          <textarea id="cdiNotes" rows="3"></textarea>
        </div>

        <div class="cdi-results" style="margin-top:14px">
          <div class="cdi-result">
            Quantité totale
            <strong id="cdiTotalPieces">0</strong>
          </div>
          <div class="cdi-result">
            Coût d'achat
            <strong id="cdiPurchaseTotal">0 BIF</strong>
          </div>
          <div class="cdi-result">
            Coût total rendu
            <strong id="cdiLandedTotal">0 BIF</strong>
          </div>
          <div class="cdi-result">
            Coût rendu / unité
            <strong id="cdiUnitCost">0 BIF</strong>
          </div>
          <div class="cdi-result">
            Recette théorique au détail
            <strong id="cdiExpectedRevenue">0 BIF</strong>
          </div>
          <div class="cdi-result">
            Bénéfice théorique
            <strong id="cdiExpectedProfit">0 BIF</strong>
          </div>
          <div class="cdi-result">
            TVA incluse estimée (18/118)
            <strong id="cdiVatEstimate">0 BIF</strong>
          </div>
        </div>

        <div class="cdi-actions">
          <button type="button" class="cdi-primary" id="cdiSave">
            Enregistrer l'importation
          </button>
          <button type="button" class="cdi-secondary" id="cdiRefresh">
            Actualiser les importations
          </button>
          <button type="button" class="cdi-secondary" id="cdiPrint">
            Imprimer
          </button>
        </div>
      </div>

      <div class="cdi-box">
        <h3>3. Recherche d'un dossier et documents de douane</h3>
        <p class="cdi-muted">
          Recherchez uniquement avec le numéro automatique du dossier d'importation.
        </p>

        <div class="cdi-grid">
          <div class="cdi-field">
            <label for="cdiSearchNumber">Numéro d'importation</label>
            <input id="cdiSearchNumber" placeholder="Ex. CDI-2026-0001">
          </div>
        </div>

        <div class="cdi-actions">
          <button type="button" class="cdi-primary" id="cdiSearch">
            Rechercher le dossier
          </button>
        </div>

        <div id="cdiSearchResult"></div>

        <div id="cdiCustomsArea" hidden>
          <div class="cdi-field">
            <label for="cdiCustomsFile">Document de douane (PDF ou image, 20 MB max.)</label>
            <input id="cdiCustomsFile" type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp">
          </div>

          <div class="cdi-actions">
            <button type="button" class="cdi-primary" id="cdiCustomsUpload">
              Enregistrer le document
            </button>
          </div>

          <div id="cdiCustomsDocuments"></div>
        </div>
      </div>

      <div class="cdi-box">
        <h3>4. Importations enregistrées</h3>

        <div class="cdi-table-wrap">
          <table>
            <thead>
              <tr>
                <th>N° importation</th>
                <th>Date</th>
                <th>Produit</th>
                <th>Pays</th>
                <th>Quantité</th>
                <th>Coût rendu (BIF)</th>
                <th>Gros (BIF)</th>
                <th>Détail (BIF)</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="cdiImportsBody">
              <tr><td colspan="10">Chargement...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    bind();
    return panel;
  }  function bind() {
    if (initialized) return;
    initialized = true;

    [
      'cdiCartons',
      'cdiPerCarton',
      'cdiPurchasePrice',
      'cdiTransport',
      'cdiCustomsCost',
      'cdiOther',
      'cdiRetail',
      'cdiWholesale'
    ].forEach((id) => {
      $(id).addEventListener('input', calculate);
    });

    $('cdiPhoto').addEventListener('change', onPhotoSelected);
    $('cdiSave').addEventListener('click', saveImport);
    $('cdiRefresh').addEventListener('click', loadImports);
    $('cdiPrint').addEventListener('click', () => window.print());
    $('cdiSearch').addEventListener('click', searchImport);
    $('cdiCustomsUpload').addEventListener('click', uploadCustomsDocument);

    $('cdiSearchNumber').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') searchImport();
    });
  }

  function onPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    photoFile = null;

    const preview = $('cdiPhotoPreview');

    if (!file) {
      preview.style.display = 'none';
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showMessage('Format photo non accepté. Utilisez JPG, PNG ou WebP.', true);
      event.target.value = '';
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      showMessage('La photo dépasse la limite de 5 MB.', true);
      event.target.value = '';
      return;
    }

    photoFile = file;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  }

  async function currentUser(client) {
    const result = await client.auth.getUser();

    if (result.error) throw result.error;

    if (!result.data || !result.data.user) {
      throw new Error('Veuillez vous connecter avant de continuer.');
    }

    return result.data.user;
  }

  async function uploadPhoto(client, userId) {
    if (!photoFile) return null;

    const extension = photoFile.name.split('.').pop().toLowerCase();

    const path =
      `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const result = await client.storage
      .from(PHOTO_BUCKET)
      .upload(path, photoFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: photoFile.type
      });

    if (result.error) throw result.error;

    return path;
  }

  async function saveImport() {
    const button = $('cdiSave');
    button.disabled = true;

    try {
      const client = requireDb();
      const user = await currentUser(client);
      const c = getCalculation();

      if (!$('cdiItem').value.trim()) {
        throw new Error('Le nom du produit est obligatoire.');
      }

      if (!c.cartons || !c.perCarton || !c.total) {
        throw new Error('Indiquez le nombre de cartons et les unités par carton.');
      }

      if (!c.purchase || c.purchase < 0) {
        throw new Error('Indiquez le prix d’achat unitaire en BIF.');
      }

      if (![
        'pieces',
        'litres',
        'rolls',
        'boxes',
        'kg',
        'sets',
        'other'
      ].includes($('cdiUnit').value)) {
        throw new Error('Unité non reconnue.');
      }

      const photoPath = await uploadPhoto(client, user.id);
      const payload = {
        created_by: user.id,
        item_name: $('cdiItem').value.trim(),
        category: $('cdiCategory').value.trim() || null,
        source_country: $('cdiCountry').value,
        supplier_name: $('cdiSupplier').value.trim() || null,
        supplier_reference: $('cdiReference').value.trim() || null,

        carton_quantity: c.cartons,
        pieces_per_carton: c.perCarton,

        purchase_currency: 'BIF',
        purchase_unit_price: c.purchase,
        exchange_rate_to_bif: 1,

        transport_cost_bif: c.transport,
        customs_cost_bif: c.customs,
        other_costs_bif: c.other,

        selling_price_per_piece_bif: c.retail,
        retail_price_bif: c.retail,
        wholesale_price_bif: c.wholesale,

        unit: $('cdiUnit').value,
        photo_path: photoPath,
        import_status: $('cdiStatus').value,
        notes: $('cdiNotes').value.trim() || null
      };

      const result = await client
        .from(TABLE)
        .insert(payload)
        .select('id, import_number')
        .single();

      if (result.error) throw result.error;

      showMessage(
        `Importation enregistrée. Numéro : ${
          result.data.import_number || 'numéro généré par la base'
        }`
      );

      $('cdiItem').value = '';
      $('cdiCategory').value = '';
      $('cdiSupplier').value = '';
      $('cdiReference').value = '';
      $('cdiPurchasePrice').value = '';
      $('cdiTransport').value = '0';
      $('cdiCustomsCost').value = '0';
      $('cdiOther').value = '0';
      $('cdiRetail').value = '';
      $('cdiWholesale').value = '';
      $('cdiNotes').value = '';
      $('cdiPhoto').value = '';
      $('cdiPhotoPreview').style.display = 'none';

      photoFile = null;

      calculate();
      await loadImports();

    } catch (error) {
      console.error('C.W.B China Dubai save error:', error);

      showMessage(
        error.message || 'Erreur pendant l’enregistrement.',
        true
      );

    } finally {
      button.disabled = false;
    }
  }  async function loadImports() {
    const body = $('cdiImportsBody');
    if (!body) return;

    body.innerHTML = '<tr><td colspan="10">Chargement...</td></tr>';

    try {
      const client = requireDb();

      const result = await client
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;

      if (!result.data || !result.data.length) {
        body.innerHTML =
          '<tr><td colspan="10">Aucune importation enregistrée.</td></tr>';
        return;
      }

      body.innerHTML = result.data.map((item) => {
        const date = item.created_at
          ? new Date(item.created_at).toLocaleDateString('fr-FR')
          : '—';

        const qty =
          `${money(item.total_pieces)} ${escapeHtml(item.unit || '')}`;

        const status = escapeHtml(item.import_status || '—');

        let action = '';

        if (item.import_status === 'Arrived' && !item.stock_received_at) {
          action = `
            <button type="button"
              class="cdi-primary"
              data-receive="${escapeHtml(item.id)}">
              Réceptionner en stock
            </button>
          `;
        } else if (item.stock_received_at) {
          action = '<span>Stock reçu</span>';
        } else {
          action = '<span>—</span>';
        }

        return `
          <tr>
            <td>${escapeHtml(item.import_number || '—')}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(item.item_name || '')}</td>
            <td>${escapeHtml(item.source_country || '')}</td>
            <td>${qty}</td>
            <td>${money(item.landed_cost_bif)}</td>
            <td>${money(item.wholesale_price_bif)}</td>
            <td>${money(item.retail_price_bif)}</td>
            <td>${status}</td>
            <td>${action}</td>
          </tr>
        `;
      }).join('');

      body.querySelectorAll('[data-receive]').forEach((button) => {
        button.addEventListener('click', () => {
          confirmReceipt(button.dataset.receive, button);
        });
      });

    } catch (error) {
      console.error('C.W.B China Dubai load error:', error);

      body.innerHTML = `
        <tr>
          <td colspan="10">
            ${escapeHtml(error.message || 'Erreur de chargement.')}
          </td>
        </tr>
      `;
    }
  }

  async function confirmReceipt(importId, button) {
    if (!window.confirm(
      'Confirmer la réception de cette importation et ajouter sa quantité dans Inventory ?'
    )) {
      return;
    }

    button.disabled = true;

    try {
      const client = requireDb();

      const result = await client.rpc(
        'cwb_cd_confirm_receipt',
        { p_import_id: importId }
      );

      if (result.error) throw result.error;

      const data = result.data || {};

      if (data.success !== true) {
        throw new Error(
          'La réception n’a pas été confirmée par Supabase.'
        );
      }

      showMessage(
        `Réception confirmée : ${money(data.quantity_added)} ${data.unit || ''} ajoutés à Inventory.`
      );

      await loadImports();

    } catch (error) {
      console.error('C.W.B China Dubai receipt error:', error);

      showMessage(
        error.message || 'Erreur pendant la réception en stock.',
        true
      );

      button.disabled = false;
    }
  }

  async function searchImport() {
    const searchButton = $('cdiSearch');

    searchButton.disabled = true;
    $('cdiSearchResult').textContent = 'Recherche...';
    $('cdiCustomsArea').hidden = true;

    customsImport = null;

    try {
      const value = $('cdiSearchNumber').value.trim();

      if (!value) {
        throw new Error('Entrez le numéro automatique du dossier.');
      }

      const client = requireDb();

      const result = await client
        .from(TABLE)
        .select('id, import_number, item_name, source_country, import_status, created_at')
        .eq('import_number', value)
        .maybeSingle();

      if (result.error) throw result.error;

      if (!result.data) {
        $('cdiSearchResult').textContent =
          'Aucun dossier trouvé avec ce numéro.';
        return;
      }

      customsImport = result.data;

      $('cdiSearchResult').innerHTML = `
        <p>
          <strong>${escapeHtml(result.data.import_number)}</strong>
          — ${escapeHtml(result.data.item_name)}
          — ${escapeHtml(result.data.source_country)}
          — ${escapeHtml(result.data.import_status)}
        </p>
      `;

      $('cdiCustomsArea').hidden = false;

      await loadCustomsDocuments();

    } catch (error) {
      $('cdiSearchResult').textContent =
        error.message || 'Erreur de recherche.';

    } finally {
      searchButton.disabled = false;
    }
  }

  async function uploadCustomsDocument() {
    const button = $('cdiCustomsUpload');

    const file =
      $('cdiCustomsFile').files &&
      $('cdiCustomsFile').files[0];

    if (!customsImport) {
      showMessage(
        'Recherchez d’abord un dossier d’importation.',
        true
      );
      return;
    }

    if (!file) {
      showMessage('Choisissez un document PDF ou une image.', true);
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      showMessage('Le document dépasse la limite de 20 MB.', true);
      return;
    }

    if (!(
      file.type === 'application/pdf' ||
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )) {
      showMessage(
        'Format non accepté. Utilisez PDF, JPG, PNG ou WebP.',
        true
      );
      return;
    }

    button.disabled = true;

    try {
      const client = requireDb();
      const user = await currentUser(client);

      const safeName =
        file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

      const path =
        `${customsImport.id}/${Date.now()}-${safeName}`;

      const upload = await client.storage
        .from(CUSTOMS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (upload.error) throw upload.error;

      const insert = await client
        .from(CUSTOMS_TABLE)
        .insert({
          import_id: customsImport.id,
          document_path: path,
          original_name: file.name,
          uploaded_by: user.id
        });

      if (insert.error) {
        await client.storage
          .from(CUSTOMS_BUCKET)
          .remove([path]);

        throw insert.error;
      }

      $('cdiCustomsFile').value = '';

      showMessage('Document de douane enregistré.');

      await loadCustomsDocuments();

    } catch (error) {
      console.error('C.W.B customs upload error:', error);

      showMessage(
        error.message || 'Erreur pendant l’enregistrement du document.',
        true
      );

    } finally {
      button.disabled = false;
    }
  }

  async function loadCustomsDocuments() {
    const container = $('cdiCustomsDocuments');

    if (!customsImport || !container) return;

    container.textContent = 'Chargement des documents...';

    try {
      const client = requireDb();

      const result = await client
        .from(CUSTOMS_TABLE)
        .select('id, document_path, original_name, created_at')
        .eq('import_id', customsImport.id)
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;

      if (!result.data || !result.data.length) {
        container.textContent =
          'Aucun document de douane enregistré pour ce dossier.';
        return;
      }

      const links = await Promise.all(
        result.data.map(async (doc) => {
          const signed = await client.storage
            .from(CUSTOMS_BUCKET)
            .createSignedUrl(doc.document_path, 3600);

          if (signed.error) {
            return `
              <li>
                ${escapeHtml(doc.original_name)}
                — lien indisponible
                (${escapeHtml(signed.error.message)})
              </li>
            `;
          }

          return `
            <li>
              <a href="${escapeHtml(signed.data.signedUrl)}"
                target="_blank" rel="noopener">
                ${escapeHtml(doc.original_name || 'Document')}
              </a>
              <span class="cdi-muted">
                ${doc.created_at
                  ? escapeHtml(new Date(doc.created_at).toLocaleDateString('fr-FR'))
                  : ''}
              </span>
            </li>
          `;
        })
      );

      container.innerHTML = `
        <h4>Documents enregistrés</h4>
        <ul>${links.join('')}</ul>
      `;

    } catch (error) {
      console.error('C.W.B customs list error:', error);

      container.textContent =
        error.message || 'Erreur de chargement des documents.';
    }
  }

  function init() {
    const panel = buildPanel();

    calculate();
    loadImports();

    return panel;
  }

  window.cwbChinaDubaiCalculate = calculate;
  window.cwbInitChinaDubaiImport = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
