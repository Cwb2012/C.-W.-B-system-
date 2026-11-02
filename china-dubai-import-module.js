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
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Coût total BIF</th>
                <th>Vente détail TTC (BIF)</th>
                <th>Vente gros TTC (BIF)</th>
                <th>Bénéfice détail estimé (BIF)</th>
                <th>Bénéfice gros estimé (BIF)</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody id="cdiTableBody">
              <tr><td colspan="16">Chargement…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (!document.getElementById('cdiStyles')) {
      const style = document.createElement('style');
      style.id = 'cdiStyles';
      style.textContent = `
        #chinaDubaiImport .cdi-panel {
          background:#fff;border:1px solid #dbe2ea;
          border-radius:12px;padding:14px;margin:14px 0;
        }
        #chinaDubaiImport label {
          display:block;font-weight:600;margin:10px 0 5px;
        }
        #chinaDubaiImport input,
        #chinaDubaiImport select,
        #chinaDubaiImport textarea {
          box-sizing:border-box;width:100%;max-width:100%;
          padding:10px;border:1px solid #cbd5e1;
          border-radius:8px;background:#fff;color:#111827;
        }
        #chinaDubaiImport button {
          padding:10px 13px;margin:5px 4px 5px 0;
          border:0;border-radius:8px;background:#1d4ed8;
          color:#fff;font-weight:600;cursor:pointer;
        }
        #chinaDubaiImport button:disabled { opacity:.6; }
        #chinaDubaiImport .cdi-grid {
          display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }
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
        #chinaDubaiImport .cdi-status-editor {
          min-width:145px;
        }
        #chinaDubaiImport .cdi-status-editor button {
          width:100%;font-size:11px;padding:7px 5px;
        }
        @media(max-width:600px) {
          #chinaDubaiImport .cdi-grid {
            grid-template-columns:1fr;
          }
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
      'cdiOther', 'cdiRetail', 'cdiWholesale', 'cdiUnit'
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
    const retail = num('cdiRetail');
    const wholesale = num('cdiWholesale');
    const retailRevenue = quantity * retail;
    const retailVat = retailRevenue * 18 / 118;
    const retailProfit = retailRevenue - retailVat - landed;
    const wholesaleRevenue = quantity * wholesale;
    const wholesaleVat = wholesaleRevenue * 18 / 118;
    const wholesaleProfit = wholesaleRevenue - wholesaleVat - landed;

    return {
      cartons, per, quantity, currency, rate, unitPrice,
      cartonPrice, purchaseTotal, purchaseBif, freight,
      customs, other, landed, retail, wholesale,
      retailRevenue, retailVat, retailProfit,
      wholesaleRevenue, wholesaleVat, wholesaleProfit
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

    $('cdiRetailRevenue').textContent =
      fmt(x.retailRevenue) + ' BIF';
    $('cdiRetailVat').textContent = fmt(x.retailVat) + ' BIF';
    $('cdiRetailProfit').textContent = fmt(x.retailProfit) + ' BIF';

    $('cdiWholesaleRevenue').textContent =
      fmt(x.wholesaleRevenue) + ' BIF';
    $('cdiWholesaleVat').textContent = fmt(x.wholesaleVat) + ' BIF';
    $('cdiWholesaleProfit').textContent =
      fmt(x.wholesaleProfit) + ' BIF';
  }
      if (!Number.isInteger(rawCartons) || rawCartons < 0 ||
        !Number.isInteger(rawPer) || rawPer < 1 ||
        !Number.isFinite(x.unitPrice) || x.unitPrice < 0) {
      message(
        'Vérifiez le nombre de cartons, les unités par carton et le prix.',
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

      const row = {
        item_name: name,
        category: $('cdiCategory').value.trim() || null,
        source_country: $('cdiOrigin').value,
        supplier_name: $('cdiSupplier').value.trim() || null,
        supplier_reference: $('cdiRef').value.trim() || null,
        carton_quantity: x.cartons,
        pieces_per_carton: x.per,
        purchase_currency: 'BIF',
        purchase_unit_price: Number(x.unitPrice.toFixed(2)),
        exchange_rate_to_bif: 1,
        transport_cost_bif: x.freight,
        customs_cost_bif: x.customs,
        other_costs_bif: x.other,
        selling_price_per_piece_bif: x.retail,
        retail_price_bif: x.retail,
        wholesale_price_bif: x.wholesale,
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

  function estimateProfit(item, sellingPrice) {
    const quantity = Number(item.total_pieces || 0);
    const landed = Number(item.landed_cost_bif || 0);
    const revenue = quantity * Number(sellingPrice || 0);
    const vat = revenue * 18 / 118;
    return revenue - vat - landed;
  }

  async function updateImportStatus(importId, select, button) {
    const client = db();

    if (!client) {
      message('Connexion Supabase indisponible.', true);
      return;
    }

    if (!importId || !select || !button) return;

    const newStatus = select.value;
    const allowed = [
      'Planned',
      'Ordered',
      'In Transit',
      'Arrived',
      'Received',
      'Cancelled'
    ];

    if (!allowed.includes(newStatus)) {
      message('Statut non valide.', true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Enregistrement…';

    try {
      const result = await client.from(TABLE)
        .update({ import_status: newStatus })
        .eq('id', importId)
        .select('id, import_number, import_status')
        .single();

      if (result.error) {
        throw result.error;
      }

      message(
        'Statut mis à jour pour ' +
        (result.data.import_number || 'le dossier') +
        ' : ' + result.data.import_status
      );

      await load();

    } catch (error) {
      message(
        'Impossible de modifier le statut : ' +
        (error.message || 'erreur Supabase'),
        true
      );
      button.disabled = false;
      button.textContent = 'Enregistrer statut';
    }
  }

  async function confirmReceipt(importId, button) {
    const client = db();

    if (!client) {
      message('Connexion Supabase indisponible.', true);
      return;
    }

    if (!confirm(
      'Confirmer la réception de cette importation et ajouter sa quantité au stock ?'
    )) {
      return;
    }

    button.disabled = true;
    button.textContent = 'Traitement…';

    try {
      const result = await client.rpc(
        'cwb_cd_confirm_receipt',
        { p_import_id: importId }
      );

      if (result.error) throw result.error;

      const payload = result.data;

      if (!payload || payload.success !== true) {
        throw new Error(
          payload?.message || 'La réception n’a pas été confirmée.'
        );
      }

      message(
        'Réception confirmée. Quantité ajoutée au stock : ' +
        fmt(payload.quantity_added) + ' ' +
        (payload.unit || 'unités') + '.'
      );

      await load();

    } catch (error) {
      message(
        'Erreur de confirmation : ' +
        (error.message || 'erreur inconnue'),
        true
      );
      button.disabled = false;
      button.textContent = 'Confirmer réception → Stock';
    }
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
        !Number.isInteger(rawPer) || rawPer < 1 ||
        !Number.isFinite(x.unitPrice) || x.unitPrice < 0) {
      message(
        'Vérifiez le nombre de cartons, les unités par carton et le prix en BIF.',
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
        category: $('cdiCategory').value.trim() || null,
        source_country: $('cdiOrigin').value,
        supplier_name: $('cdiSupplier').value.trim() || null,
        supplier_reference: $('cdiRef').value.trim() || null,
        carton_quantity: x.cartons,
        pieces_per_carton: x.per,
        purchase_currency: 'BIF',
        purchase_unit_price: Number(x.unitPrice.toFixed(2)),
        exchange_rate_to_bif: 1,
        transport_cost_bif: x.freight,
        customs_cost_bif: x.customs,
        other_costs_bif: x.other,
        selling_price_per_piece_bif: x.retail,
        retail_price_bif: x.retail,
        wholesale_price_bif: x.wholesale,
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

  function estimateProfit(item, sellingPrice) {
    const quantity = Number(item.total_pieces || 0);
    const revenue = quantity * Number(sellingPrice || 0);
    const estimatedVat = revenue * 18 / 118;
    const landed = Number(item.landed_cost_bif || 0);
    return revenue - estimatedVat - landed;
  }

  async function confirmReceipt(importId, button) {
    if (!importId) return;
    if (!confirm('Confirmer la réception de cette importation ? Le stock sera ajouté une seule fois dans Inventory.')) return;

    const client = db();
    if (!client) {
      message('Connexion Supabase indisponible.', true);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Confirmation…';
    }

    try {
      const result = await client.rpc('cwb_cd_confirm_receipt', {
        p_import_id: importId
      });

      if (result.error) throw result.error;

      const payload = Array.isArray(result.data)
        ? result.data[0]
        : result.data;

      if (!payload || payload.success !== true) {
        throw new Error(payload?.message || 'Supabase n’a pas confirmé l’ajout au stock.');
      }

      message(
        'Réception confirmée. Stock ajouté : ' +
        fmt(payload.quantity_added) + ' ' + (payload.unit || 'unités') +
        ' — coût unitaire : ' + fmt(payload.unit_landed_cost_bif) + ' BIF.'
      );

      await load();
    } catch (error) {
      message('Échec de la confirmation de réception : ' + (error.message || error), true);
      if (button) {
        button.disabled = false;
        button.textContent = 'Confirmer réception → Stock';
      }
    }
  }

  async function updateImportStatus(importId, select, button) {
    const client = db();
    const allowed = ['Planned', 'Ordered', 'In Transit', 'Arrived', 'Received', 'Cancelled'];
    const status = select && select.value;

    if (!client || !importId || !allowed.includes(status)) {
      message('Statut invalide ou connexion Supabase indisponible.', true);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = 'Enregistrement…';
    }

    try {
      const result = await client.from(TABLE)
        .update({ import_status: status })
        .eq('id', importId)
        .select('id, import_number, import_status')
        .single();

      if (result.error) throw result.error;
      if (!result.data) throw new Error('Le dossier n’a pas été modifié.');

      message('Statut du dossier ' + (result.data.import_number || '') +
        ' mis à jour : ' + result.data.import_status + '.');
      await load();
    } catch (error) {
      message('Modification du statut impossible : ' +
        (error.message || 'erreur inconnue') +
        '. Vérifiez les autorisations UPDATE dans Supabase.', true);
      if (button) {
        button.disabled = false;
        button.textContent = 'Enregistrer statut';
      }
    }
  }

  async function load() {
    const body = $('cdiRows');
    if (!body) return;

    const client = db();

    if (!client) {
      body.innerHTML =
        '<tr><td colspan="16">Connexion Supabase indisponible.</td></tr>';
      return;
    }

    body.innerHTML =
      '<tr><td colspan="16">Chargement…</td></tr>';

    try {
      const result = await client.from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (result.error) {
        body.innerHTML =
          '<tr><td colspan="16">Erreur Supabase : ' +
          esc(result.error.message) + '</td></tr>';
        return;
      }

      if (!result.data || !result.data.length) {
        body.innerHTML =
          '<tr><td colspan="16">Aucun produit enregistré.</td></tr>';
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
          '<td>' + fmt(item.total_pieces) + '</td>' +
          '<td>' + fmt(item.purchase_unit_price) + ' ' +
            esc(item.purchase_currency) + '</td>' +
          '<td>' + fmt(item.landed_cost_bif) + ' BIF</td>' +
          '<td>' + fmt(Number(item.retail_price_bif || 0) ||
            Number(item.selling_price_per_piece_bif || 0)) + ' BIF</td>' +
          '<td>' + fmt(item.wholesale_price_bif) + ' BIF</td>' +
          '<td>' + fmt(estimateProfit(item,
            Number(item.retail_price_bif || 0) ||
            Number(item.selling_price_per_piece_bif || 0))) + ' BIF</td>' +
          '<td>' + fmt(estimateProfit(item,
            Number(item.wholesale_price_bif || 0))) + ' BIF</td>' +
          '<td>' +
            '<div class="cdi-status-editor">' +
              '<select class="cdi-status-select" data-import-id="' + esc(item.id) + '" ' +
                (item.stock_received_at ? 'disabled' : '') + '>' +
                ['Planned','Ordered','In Transit','Arrived','Received','Cancelled'].map(status =>
                  '<option value="' + status + '" ' +
                  (item.import_status === status ? 'selected' : '') + '>' +
                  status + '</option>'
                ).join('') +
              '</select>' +
              '<button type="button" class="cdi-save-status" data-import-id="' +
                esc(item.id) + '" ' + (item.stock_received_at ? 'disabled' : '') +
                '>Enregistrer statut</button>' +
            '</div>' +
          '</td>' +
          '<td>' + esc(burundiTime(item.created_at)) + '</td>' +
          '<td>' + (item.stock_received_at
            ? '<b>Stock ajouté</b>'
            : item.import_status === 'Arrived'
              ? '<button type="button" class="cdi-confirm-receipt" data-import-id="' + esc(item.id) + '">Confirmer réception → Stock</button>'
              : 'En attente de réception') + '</td>' +
          '</tr>';
      }));

      body.innerHTML = rows.join('');

      body.querySelectorAll('.cdi-confirm-receipt').forEach(button => {
        button.addEventListener('click', () =>
          confirmReceipt(button.dataset.importId, button)
        );
      });

      body.querySelectorAll('.cdi-save-status').forEach(button => {
        button.addEventListener('click', () => {
          const select = body.querySelector(
            '.cdi-status-select[data-import-id="' + button.dataset.importId + '"]'
          );
          if (select) updateImportStatus(button.dataset.importId, select, button);
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
        '<tr><td colspan="16">Erreur : ' +
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
