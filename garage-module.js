/* =========================================================
   C.W.B SYSTEM — GARAGE MODULE
   Version indépendante
   Tables Supabase existantes : 
   cwb_garage_vehicle_intakes
   cwb_garage_quotations
   cwb_garage_insurance_reviews
   cwb_garage_documents
   Garage_jobs

   IMPORTANT : ne supprime aucune donnée existante.
========================================================= */

(function () {
  "use strict";

  const db =
    window.cwbSupabaseClient ||
    window.supabaseClient;

  const BUCKET = "cwb-garage-documents";

  const TABLES = {
    intakes: "cwb_garage_vehicle_intakes",
    quotes: "cwb_garage_quotations",
    insurance: "cwb_garage_insurance_reviews",
    documents: "cwb_garage_documents",
    jobs: "Garage_jobs"
  };

  let root = null;
  let currentPage = "home";

  const money = value =>
    Number(value || 0).toLocaleString("fr-FR") + " BIF";

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const today = () => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  };

  function notify(message, error = false) {
    let box = document.getElementById("cwbGarageMessage");

    if (!box) {
      box = document.createElement("div");
      box.id = "cwbGarageMessage";
      root.prepend(box);
    }

    box.style.cssText =
      "padding:12px;margin:10px 0;border-radius:8px;" +
      "background:" + (error ? "#ffe3e3" : "#e1f5e7") +
      ";color:#222;font-weight:bold;";

    box.textContent = message;

    window.setTimeout(() => {
      if (box) box.remove();
    }, 6000);
  }

  async function getRows(table, order = "created_at") {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order(order, { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function saveRow(table, values) {
    const { data, error } = await db
      .from(table)
      .insert(values)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
   
async function updateRow(table, id, values) {
  const { data, error } = await db
    .from(table)
    .update(values)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}


  function field(label, name, type = "text", required = false) {
    return `
      <label class="cwb-g-label">
        ${escapeHTML(label)}
        <input class="cwb-g-input"
          name="${escapeHTML(name)}"
          type="${type}"
          ${required ? "required" : ""}
        >
      </label>
    `;
  }

  function area(label, name, required = false) {
    return `
      <label class="cwb-g-label">
        ${escapeHTML(label)}
        <textarea class="cwb-g-input"
          name="${escapeHTML(name)}"
          rows="3"
          ${required ? "required" : ""}
        ></textarea>
      </label>
    `;
  }

  function selectField(label, name, options) {
    return `
      <label class="cwb-g-label">
        ${escapeHTML(label)}
        <select class="cwb-g-input"
          name="${escapeHTML(name)}">
          ${options.map(option =>
            `<option value="${escapeHTML(option)}">
              ${escapeHTML(option)}
            </option>`
          ).join("")}
        </select>
      </label>
    `;
  }

  function formBox(title, content, button = "Enregistrer") {
    return `
      <section class="cwb-g-card">
        <h3>${escapeHTML(title)}</h3>
        <form class="cwb-g-form">
          ${content}
          <button class="cwb-g-button" type="submit">
            ${escapeHTML(button)}
          </button>
        </form>
      </section>
    `;
  }

  function tableBox(headers, rows) {
    if (!rows.length) {
      return `<p class="cwb-g-empty">Aucun document enregistré.</p>`;
    }

    return `
      <div class="cwb-g-table-wrap">
        <table class="cwb-g-table">
          <thead>
            <tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function pageHeader(title, subtitle = "") {
    return `
      <div class="cwb-g-heading">
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(subtitle)}</p>
      </div>
    `;
  }


/* =========================================
   C.W.B GARAGE — IMPRESSION DES DOCUMENTS
   Devis et factures : format professionnel
========================================= */

function printGarageDocument(type, r) {

  if (!r) {
    notify("Aucune donnée disponible pour imprimer.", true);
    return;
  }

  const esc = value =>
    escapeHTML(String(value ?? ""));

  const amount = value => money(Number(value || 0));

  const getLineTotal = line => {
    if (line.total !== undefined && line.total !== null) {
      return Number(line.total || 0);
    }

    return Number(line.quantity || 0) *
           Number(line.unit_price || 0);
  };

  const getCategory = line =>
    String(line.category || "").toLowerCase().trim();

  const getLines = value =>
    Array.isArray(value) ? value : [];

  const makeLineRows = lines => {

    if (!lines.length) {
      return `
        <tr>
          <td colspan="4" class="empty">
            Aucune ligne détaillée enregistrée
          </td>
        </tr>
      `;
    }

    return lines.map((line, index) => {

      const quantity = Number(line.quantity || 0);
      const unitPrice = Number(line.unit_price || 0);
      const total = getLineTotal(line);

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${esc(line.item_name || line.description || "")}</td>
          <td class="center">${quantity}</td>
          <td class="number">${amount(unitPrice)}</td>
          <td class="number">${amount(total)}</td>
        </tr>
      `;

    }).join("");
  };

  const makeSection = (title, lines, fallbackAmount) => {

    const total = lines.length
      ? lines.reduce((sum, line) => sum + getLineTotal(line), 0)
      : Number(fallbackAmount || 0);

    return `
      <h3>${esc(title)}</h3>

      <table class="items">
        <thead>
          <tr>
            <th>N°</th>
            <th>Désignation</th>
            <th>Qté</th>
            <th>Prix unitaire</th>
            <th>Montant</th>
          </tr>
        </thead>

        <tbody>
          ${lines.length
            ? makeLineRows(lines)
            : `
              <tr>
                <td>1</td>
                <td>${esc(title)}</td>
                <td>1</td>
                <td class="number">${amount(total)}</td>
                <td class="number">${amount(total)}</td>
              </tr>
            `
          }
        </tbody>
      </table>

      <div class="section-total">
        Total ${esc(title)} : ${amount(total)}
      </div>
    `;
  };

  let documentContent = "";
  let documentTitle = "";
  let documentNumber = "";

  /* =========================================
     1. FICHE DE RÉCEPTION
  ========================================= */

  if (type === "intake") {

    documentTitle = "FICHE DE RÉCEPTION DU VÉHICULE";
    documentNumber = r.intake_number;

    const fields = [
      ["Client", r.customer_name],
      ["Téléphone", r.customer_phone],
      ["Adresse", r.customer_address],
      ["Véhicule", r.vehicle_name],
      ["Modèle", r.vehicle_model],
      ["Plaque", r.plate_number],
      ["VIN", r.vin_number],
      ["Couleur", r.vehicle_color],
      ["Kilométrage", r.mileage],
      ["Carburant", r.fuel_level],
      ["Plainte du client", r.customer_complaint],
      ["État carrosserie", r.body_condition],
      ["État peinture", r.paint_condition],
      ["Vitres et éclairage", r.glass_condition],
      ["Dommages visibles", r.visible_damage],
      ["Accessoires reçus", r.received_items_notes],
      ["Notes inspection", r.inspection_notes],
      ["Réceptionnaire", r.receiver_name],
      ["Date de réception", r.received_at]
    ];

    documentContent = `
      <h3>Informations de réception</h3>

      <table class="info">
        ${fields
          .filter(item => item[1] !== null &&
                          item[1] !== undefined &&
                          item[1] !== "")
          .map(item => `
            <tr>
              <th>${esc(item[0])}</th>
              <td>${esc(item[1])}</td>
            </tr>
          `).join("")}
      </table>
    `;
  }

  /* =========================================
     2. DEVIS DE RÉPARATIONS
  ========================================= */

  else if (type === "quote") {

    documentTitle = "DEVIS DE RÉPARATIONS";
    documentNumber = r.quote_number;

    const lines = getLines(r.lines);

    const parts = lines.filter(line =>
      ["part", "parts", "piece", "pièce"].includes(
        getCategory(line)
      )
    );

    const products = lines.filter(line =>
      ["product_repair", "product", "repair"].includes(
        getCategory(line)
      )
    );

    const labourLines = lines.filter(line =>
      ["labour", "labor", "main_doeuvre", "main-d'oeuvre"].includes(
        getCategory(line)
      )
    );

    const productTotal = products.reduce(
      (sum, line) => sum + getLineTotal(line), 0
    );

    const labourTotal = labourLines.length
      ? labourLines.reduce(
          (sum, line) => sum + getLineTotal(line), 0
        )
      : Number(r.labour_amount || 0);

    const partsTotal = Number(r.parts_amount || 0);

    const subtotal = Number(
      r.subtotal_amount ||
      (partsTotal + productTotal + labourTotal)
    );

    const discount = Number(r.discount_amount || 0);
    const taxRate = Number(r.tax_rate ?? 18);
    const tax = Number(r.tax_amount || 0);
    const total = Number(r.total_amount || (subtotal - discount + tax));

    documentContent = `

      <div class="info-grid">

        <div>
          <h3>Informations du client</h3>
          <p><strong>Client :</strong> ${esc(r.customer_name)}</p>
          <p><strong>Téléphone :</strong> ${esc(r.customer_phone)}</p>
          <p><strong>Adresse :</strong> ${esc(r.customer_address)}</p>
        </div>

        <div>
          <h3>Informations du véhicule</h3>
          <p><strong>Véhicule :</strong> ${esc(r.vehicle_name)}</p>
          <p><strong>Modèle :</strong> ${esc(r.vehicle_model)}</p>
          <p><strong>Immatriculation :</strong> ${esc(r.plate_number)}</p>
          <p><strong>Couleur :</strong> ${esc(r.vehicle_color)}</p>
        </div>

      </div>

      <h3>Description des réparations</h3>
      <div class="description">
        ${esc(r.repair_description || "Non renseignée")}
      </div>

      ${makeSection("Pièces à remplacer", parts, partsTotal)}

      ${makeSection(
        "Produits et réparations",
        products,
        productTotal
      )}

      <h3>Main-d'œuvre</h3>

      ${labourLines.length
        ? `
          <table class="items">
            <thead>
              <tr>
                <th>N°</th>
                <th>Désignation</th>
                <th>Qté</th>
                <th>Prix unitaire</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>${makeLineRows(labourLines)}</tbody>
          </table>
        `
        : `
          <div class="description">
            Montant de la main-d'œuvre : ${amount(labourTotal)}
          </div>
        `
      }

      <div class="totals">
        <div><span>Total pièces</span><strong>${amount(partsTotal)}</strong></div>
        <div><span>Produits et réparations</span><strong>${amount(productTotal)}</strong></div>
        <div><span>Main-d'œuvre</span><strong>${amount(labourTotal)}</strong></div>
        <div><span>Sous-total HT</span><strong>${amount(subtotal)}</strong></div>
        <div><span>Remise</span><strong>${amount(discount)}</strong></div>
        <div><span>TVA (${taxRate} %)</span><strong>${amount(tax)}</strong></div>
        <div class="grand-total">
          <span>TOTAL TTC</span>
          <strong>${amount(total)}</strong>
        </div>
      </div>

      <div class="conditions">
        <p><strong>Validité du devis :</strong> ${esc(r.validity || "Non précisée")}</p>
        <p><strong>Statut :</strong> ${esc(r.status || "En attente")}</p>
        <p><strong>Notes :</strong> ${esc(r.notes || "")}</p>
      </div>
    `;
  }

  /* =========================================
     3. FACTURE GARAGE
  ========================================= */

  else if (type === "invoice") {

    documentTitle = "FACTURE DE RÉPARATIONS";
    documentNumber = r.invoice_number || r.Invoice_number;

    const lines = getLines(r.quotation_lines);

    const parts = lines.filter(line =>
      ["part", "parts", "piece", "pièce"].includes(
        getCategory(line)
      )
    );

    const products = lines.filter(line =>
      ["product_repair", "product", "repair"].includes(
        getCategory(line)
      )
    );

    const labourLines = lines.filter(line =>
      ["labour", "labor", "main_doeuvre", "main-d'oeuvre"].includes(
        getCategory(line)
      )
    );

    const partsTotal = Number(
      r.parts_cost || r.Parts_coast || 0
    );

    const productTotal = products.reduce(
      (sum, line) => sum + getLineTotal(line), 0
    );

    const labourTotal = Number(r.labor_cost || r.Job_cost || 0);

    const subtotal = Number(
      r.garage_subtotal_ht ||
      r.quotation_total ||
      (partsTotal + productTotal + labourTotal)
    );

    const discount = Number(r.quotation_discount || 0);
    const taxRate = Number(r.garage_tax_rate ?? 18);
    const tax = Number(r.garage_tax_amount || r.quotation_tax || 0);

    const total = Number(
      r.garage_total_ttc ||
      r.final_coast ||
      r.Job_cost ||
      r.cost ||
      r.estimated_cost ||
      (subtotal - discount + tax)
    );

    const paid = Number(r.paid_amount || 0);
    const balance = Math.max(0, total - paid);

    documentContent = `

      <div class="info-grid">

        <div>
          <h3>Informations du client</h3>
          <p><strong>Client :</strong> ${esc(r.customer_name)}</p>
          <p><strong>Téléphone :</strong> ${esc(r.customer_phone || r.Customer_phone)}</p>
          <p><strong>Adresse :</strong> ${esc(r.customer_address)}</p>
        </div>

        <div>
          <h3>Informations du véhicule</h3>
          <p><strong>Véhicule :</strong> ${esc(r.Vehicle_name || r.vehicle_name)}</p>
          <p><strong>Modèle :</strong> ${esc(r.Vehicle_model || r.vehicle_model)}</p>
          <p><strong>Plaque :</strong> ${esc(r.Vehicle_plate)}</p>
          <p><strong>Couleur :</strong> ${esc(r.Vehicle_color)}</p>
        </div>

      </div>

      <h3>Référence du devis</h3>
      <p>${esc(r.quotation_number || "Non renseignée")}</p>

      <h3>Travaux effectués</h3>
      <div class="description">
        ${esc(r.Job_description || r.repaire_descrption || "")}
      </div>

      ${makeSection(
        "Pièces à remplacer",
        parts,
        partsTotal
      )}

      ${makeSection(
        "Produits et réparations",
        products,
        productTotal
      )}

      <h3>Main-d'œuvre</h3>

      ${labourLines.length
        ? `
          <table class="items">
            <thead>
              <tr>
                <th>N°</th>
                <th>Désignation</th>
                <th>Qté</th>
                <th>Prix unitaire</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>${makeLineRows(labourLines)}</tbody>
          </table>
        `
        : `
          <div class="description">
            Main-d'œuvre : ${amount(labourTotal)}
          </div>
        `
      }

      <div class="totals">
        <div><span>Sous-total HT</span><strong>${amount(subtotal)}</strong></div>
        <div><span>Remise</span><strong>${amount(discount)}</strong></div>
        <div><span>TVA (${taxRate} %)</span><strong>${amount(tax)}</strong></div>
        <div class="grand-total">
          <span>TOTAL TTC</span>
          <strong>${amount(total)}</strong>
        </div>
        <div><span>Montant payé</span><strong>${amount(paid)}</strong></div>
        <div class="balance">
          <span>Reste à payer</span><strong>${amount(balance)}</strong>
        </div>
      </div>

      <div class="conditions">
        <p><strong>Mécanicien :</strong> ${esc(r.mechanic_name || r.machanic_name)}</p>
        <p><strong>Statut de paiement :</strong> ${esc(r.Payment_status)}</p>
        <p><strong>Date :</strong> ${esc(r.Job_date || r.service_date)}</p>
        <p><strong>Notes :</strong> ${esc(r.Notes || r.notes || "")}</p>
      </div>
    `;
  }

  else {
    notify("Type de document non reconnu.", true);
    return;
  }

  /* =========================================
     4. OUVERTURE DE LA FENÊTRE D'IMPRESSION
  ========================================= */

  const win = window.open("", "_blank");

  if (!win) {
    notify("Autorise les fenêtres pop-up pour imprimer.", true);
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="fr">

    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">

      <title>${esc(documentTitle)}</title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #222;
          margin: 0;
          padding: 25px;
          font-size: 12px;
        }

        .header {
          text-align: center;
          border-bottom: 4px solid #173b63;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }

        .header h1 {
          color: #b51f2a;
          font-size: 27px;
          margin: 0 0 5px;
        }

        .header p {
          margin: 4px;
        }

        .slogan {
          font-weight: bold;
          color: #173b63;
        }

        h2 {
          text-align: center;
          color: #173b63;
          margin: 20px 0 8px;
          font-size: 21px;
        }

        .number {
          text-align: center;
          font-weight: bold;
          margin-bottom: 20px;
          font-size: 13px;
        }

        h3 {
          background: #173b63;
          color: white;
          padding: 8px;
          font-size: 13px;
          margin-top: 20px;
          margin-bottom: 8px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .info-grid > div {
          border: 1px solid #bbb;
          padding: 8px;
        }

        .info-grid h3 {
          margin: -8px -8px 8px;
        }

        .info-grid p {
          margin: 6px 0;
        }

        .description {
          border: 1px solid #bbb;
          padding: 10px;
          min-height: 30px;
          white-space: pre-wrap;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          border: 1px solid #aaa;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }

        .items thead th {
          background: #e8edf3;
          color: #173b63;
        }

        .items .center {
          text-align: center;
        }

        .items .number {
          text-align: right;
          margin: 0;
        }

        .empty {
          text-align: center;
          color: #777;
        }

        .section-total {
          text-align: right;
          font-weight: bold;
          padding: 8px;
          border: 1px solid #ddd;
          border-top: none;
        }

        .info th {
          width: 35%;
          background: #eee;
        }

        .totals {
          width: 55%;
          margin: 20px 0 20px auto;
          border: 1px solid #aaa;
          padding: 10px;
        }

        .totals > div {
          display: flex;
          justify-content: space-between;
          padding: 6px;
          gap: 15px;
          border-bottom: 1px solid #ddd;
        }

        .totals .grand-total {
          background: #173b63;
          color: white;
          font-size: 16px;
          font-weight: bold;
          padding: 12px 8px;
        }

        .totals .balance {
          font-weight: bold;
          color: #b51f2a;
        }

        .conditions {
          margin-top: 20px;
          border: 1px solid #bbb;
          padding: 10px;
        }

        .signatures {
          display: flex;
          justify-content: space-between;
          gap: 30px;
          margin-top: 65px;
          page-break-inside: avoid;
        }

        .signatures div {
          width: 45%;
          text-align: center;
          border-top: 1px solid #222;
          padding-top: 10px;
        }

        .footer {
          text-align: center;
          margin-top: 35px;
          padding-top: 10px;
          border-top: 1px solid #aaa;
          font-size: 11px;
        }

        .print-button {
          display: block;
          margin: 25px auto;
          padding: 12px 25px;
          background: #173b63;
          color: white;
          border: none;
          border-radius: 5px;
          font-weight: bold;
          cursor: pointer;
        }

        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          body {
            padding: 0;
            font-size: 11px;
          }

          .print-button {
            display: none;
          }

          h3, .grand-total {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          tr {
            page-break-inside: avoid;
          }
        }

      </style>
    </head>

    <body>

      <div class="header">
        <h1>C.W.B SYSTEM</h1>
        <p>Camel Work and Business company</p>
        <p class="slogan">Better Quality is our priority</p>
        <p>Bujumbura, Chaussée du Peuple Murundi No. 54</p>
        <p>Tél : 67481564 / 62180032</p>
        <p>NIF : 4002652933</p>
      </div>

      <h2>${esc(documentTitle)}</h2>

      <div class="number">
        N° : ${esc(documentNumber || "Non disponible")}
      </div>

      ${documentContent}

      <div class="signatures">
        <div>Signature du client</div>
        <div>Signature et cachet C.W.B</div>
      </div>

      <div class="footer">
        C.W.B System • Master Version 2
      </div>

      <button class="print-button" onclick="window.print()">
        IMPRIMER / ENREGISTRER EN PDF
      </button>

    </body>
    </html>
  `);

  win.document.close();
}   
/* Ajouter les boutons aux documents enregistrés */

function attachGaragePrintButtons(rows, type) {

  const page = root.querySelector("#cwbGaragePage");

  if (!page) {
    console.error("C.W.B: Garage page introuvable.");
    return;
  }

  const buttons = page.querySelectorAll("[data-garage-print]");

  buttons.forEach(button => {

    button.addEventListener("click", () => {

      const index = Number(button.dataset.garagePrint);

      if (rows[index]) {
        printGarageDocument(type, rows[index]);
      }

    });

  });
}
  function navButton(page, label, icon) {
    return `
      <button class="cwb-g-nav"
        type="button"
        data-page="${page}">
        ${icon} ${escapeHTML(label)}
      </button>
    `;
  }

  function renderShell() {
    root.innerHTML = `
      <div class="cwb-garage">
        <style>
          .cwb-garage {
            color:var(--text-color, #222);
            font-family:Arial,sans-serif;
            padding:12px;
          }
          .cwb-g-heading h2 { margin:8px 0; }
          .cwb-g-heading p { color:#777; }
          .cwb-g-navs {
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:8px;
            margin:15px 0;
          }
          .cwb-g-nav,.cwb-g-button {
            border:0;
            border-radius:8px;
            padding:12px;
            font-weight:bold;
            cursor:pointer;
            background:#173b63;
            color:white;
          }
          .cwb-g-nav { min-height:48px; }
          .cwb-g-card {
            border:1px solid #ccc;
            border-radius:10px;
            padding:14px;
            margin:12px 0;
            background:var(--card-background, transparent);
          }
          .cwb-g-label {
            display:block;
            font-weight:bold;
            margin:12px 0;
          }
          .cwb-g-input {
            display:block;
            box-sizing:border-box;
            width:100%;
            padding:11px;
            margin-top:6px;
            border:1px solid #aaa;
            border-radius:7px;
            background:var(--input-background, white);
            color:var(--text-color, #222);
          }
          .cwb-g-button { margin-top:10px; }
          .cwb-g-table-wrap { overflow-x:auto; }
          .cwb-g-table {
            width:100%;
            border-collapse:collapse;
            min-width:500px;
          }
          .cwb-g-table th,.cwb-g-table td {
            border:1px solid #ccc;
            padding:9px;
            text-align:left;
          }
          .cwb-g-empty { padding:12px;color:#777; }
          .cwb-g-back {
            margin:8px 0;
            background:#555;
          }
          .cwb-g-actions {
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          }
          @media(min-width:700px) {
            .cwb-g-navs {
              grid-template-columns:repeat(3,minmax(0,1fr));
            }
          }
        </style>

        <div class="cwb-g-heading">
          <h1>🚘 C.W.B GARAGE</h1>
          <p>Camel Work and Business Company</p>
          <strong>Better Quality is our priority</strong>
        </div>

        <div class="cwb-g-navs">
          ${navButton("intakes", "Réception", "🚗")}
          ${navButton("quotes", "Devis", "📋")}
          ${navButton("insurance", "Contre-expertise", "🛡️")}
          ${navButton("jobs", "Activités", "🔧")}
          ${navButton("invoices", "Factures", "🧾")}
          ${navButton("documents", "Archives", "📁")}
        </div>

        <div id="cwbGaragePage"></div>
      </div>
    `;

    root.querySelectorAll("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        openPage(button.dataset.page);
      });
    });
  }

  function showPage(content) {
    const page = root.querySelector("#cwbGaragePage");

    page.innerHTML = `
      <button class="cwb-g-button cwb-g-back"
        type="button" data-back="true">
        ← Retour à l'accueil Garage
      </button>
      ${content}
    `;

    page.querySelector("[data-back]").addEventListener("click", home);
  }

  function home() {
    currentPage = "home";

    root.querySelector("#cwbGaragePage").innerHTML = `
      ${pageHeader(
        "Bienvenue dans C.W.B Garage",
        "Gestion des véhicules, devis, réparations et factures."
      )}
      <div class="cwb-g-card">
        <p>🚗 Réception et inspection des véhicules</p>
        <p>📋 Création et approbation des devis</p>
        <p>🛡️ Gestion des dossiers d'assurance</p>
        <p>🔧 Suivi des réparations et mécaniciens</p>
        <p>🧾 Factures avec numérotation Supabase</p>
        <p>📁 Archivage et recherche de documents</p>
      </div>
    `;
  }

  async function openPage(page) {
    currentPage = page;

    try {
      if (page === "intakes") return await showIntakes();
      if (page === "quotes") return await showQuotes();
      if (page === "insurance") return await showInsurance();
      if (page === "jobs") return await showJobs();
      if (page === "invoices") return await showInvoices();
      if (page === "documents") return await showDocuments();
    } catch (error) {
      console.error("C.W.B Garage:", error);
      notify("Erreur : " + (error.message || error), true);
    }
  }

  /* =====================================================
     1. RECEPTION DES VEHICULES
  ===================================================== */

async function showIntakes() {
  const rows = await getRows(TABLES.intakes, "created_at");

  const photoPaths = r => {
    const list = Array.isArray(r.intake_photos)
      ? r.intake_photos
      : (Array.isArray(r.photo_paths) ? r.photo_paths : []);

    return list.map(p =>
      typeof p === "string" ? p : (p.path || p.storage_path || "")
    ).filter(Boolean);
  };

  const getSignedPhotos = async r => {
    const urls = [];

    for (const path of photoPaths(r)) {
      const result = await db.storage
        .from(BUCKET)
        .createSignedUrl(path, 300);

      if (!result.error && result.data?.signedUrl) {
        urls.push(result.data.signedUrl);
      }
    }

    return urls;
  };

  const printIntake = async r => {
    const win = window.open("", "_blank");

    if (!win) {
      notify("Autorise les fenêtres pop-up pour imprimer.");
      return;
    }

    const photos = await getSignedPhotos(r);

    const details = [
      ["Numéro de réception", r.intake_number],
      ["Date de réception", r.received_at],
      ["Client", r.customer_name],
      ["Téléphone", r.customer_phone],
      ["Adresse", r.customer_address],
      ["Véhicule", r.vehicle_name],
      ["Modèle", r.vehicle_model],
      ["Plaque", r.plate_number],
      ["VIN", r.vin_number],
      ["Couleur", r.vehicle_color],
      ["Kilométrage", r.mileage],
      ["Carburant", r.fuel_level],
      ["Plainte du client", r.customer_complaint],
      ["État de la carrosserie", r.body_condition],
      ["État de la peinture", r.paint_condition],
      ["Vitres et éclairage", r.glass_condition],
      ["Dommages visibles", r.visible_damage],
      ["Accessoires reçus", r.received_items_notes],
      ["Notes d'inspection", r.inspection_notes],
      ["Réceptionnaire", r.receiver_name]
    ];

    const content = details.map(item => `
      <tr>
        <th>${escapeHTML(item[0])}</th>
        <td>${escapeHTML(item[1] || "-")}</td>
      </tr>
    `).join("");

    const photoHTML = photos.map(url => `
      <img src="${escapeHTML(url)}"
        style="width:220px;max-height:180px;object-fit:contain;margin:8px;">
    `).join("");

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Fiche de réception</title>
        <style>
          body { font-family: Arial; padding: 20px; color: #111; }
          h2, h3 { text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #777; padding: 8px; text-align: left; }
          th { width: 30%; background: #eee; }
          .photos { margin-top: 20px; }
          img { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <h2>C.W.B SYSTEM</h2>
        <h3>FICHE DE RÉCEPTION DU VÉHICULE</h3>
        <table>${content}</table>
        <h3>Photos du véhicule à son arrivée</h3>
        <div class="photos">
          ${photoHTML || "Aucune photo enregistrée."}
        </div>
      </body>
      </html>
    `);

    win.document.close();
    win.onload = () => win.print();
  };

  showPage(`
    ${pageHeader("Réception des véhicules",
      "Créer, rechercher et consulter les fiches de réception.")}

    ${formBox("Nouvelle fiche de réception", `
      ${field("Nom du client", "customer_name", "text", true)}
      ${field("Téléphone", "customer_phone")}
      ${field("Adresse du client", "customer_address")}
      ${field("Marque / véhicule", "vehicle_name", "text", true)}
      ${field("Modèle", "vehicle_model")}
      ${field("Plaque d'immatriculation", "plate_number")}
      ${field("Numéro VIN", "vin_number")}
      ${field("Couleur", "vehicle_color")}
      ${field("Kilométrage", "mileage", "number")}
      ${selectField("Niveau de carburant", "fuel_level",
        ["Vide", "1/4", "1/2", "3/4", "Plein", "Non vérifié"])}
      ${area("Plainte du client", "customer_complaint")}
      ${area("État de la carrosserie", "body_condition")}
      ${area("État de la peinture", "paint_condition")}
      ${area("Vitres et éclairage", "glass_condition")}
      ${area("Dommages visibles", "visible_damage")}
      ${area("Accessoires reçus", "received_items_notes")}
      ${area("Notes d'inspection", "inspection_notes")}
      ${field("Nom du réceptionnaire", "receiver_name")}

      <label style="display:block;margin-top:15px;font-weight:bold;">
        Photos du véhicule (20 maximum)
      </label>
      <input
        type="file"
        name="intake_photos"
        accept="image/*"
        multiple
        style="display:block;margin-top:8px;width:100%;"
      >
      <small>
        Sélectionne les photos depuis ton téléphone ou l'appareil photo.
      </small>
    `, "Enregistrer la réception")}

    <h3>Archives des réceptions</h3>

    <input
      type="search"
      id="intakeSearch"
      placeholder="Rechercher numéro, client, téléphone, plaque ou véhicule..."
      style="width:100%;padding:12px;margin:10px 0;"
    >

    ${tableBox(
      ["Numéro", "Client", "Véhicule", "Plaque", "Date", "Actions"],
      rows.map((r, i) => {
        const searchText = [
          r.intake_number,
          r.customer_name,
          r.customer_phone,
          r.plate_number,
          r.vehicle_name,
          r.vehicle_model
        ].join(" ").toLowerCase();

        return `
          <tr data-intake-row
              data-search="${escapeHTML(searchText)}">
            <td>${escapeHTML(r.intake_number || "En attente")}</td>
            <td>${escapeHTML(r.customer_name || "")}</td>
            <td>${escapeHTML(r.vehicle_name || "")}</td>
            <td>${escapeHTML(r.plate_number || "")}</td>
            <td>${escapeHTML(r.received_at || "")}</td>
            <td>
              <button type="button"
                data-intake-open="${escapeHTML(r.id)}">
                Ouvrir
              </button>
              <button type="button"
                data-intake-print="${i}">
                Imprimer
              </button>
            </td>
          </tr>
        `;
      })
    )}

    <div id="intakeDetails" style="margin-top:20px;"></div>
  `);

  const searchInput = document.getElementById("intakeSearch");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase().trim();

      document.querySelectorAll("[data-intake-row]").forEach(row => {
        row.style.display =
          row.dataset.search.includes(term) ? "" : "none";
      });
    });
  }

  document.querySelectorAll("[data-intake-open]").forEach(button => {
    button.addEventListener("click", async () => {
      const r = rows.find(x =>
        String(x.id) === button.dataset.intakeOpen
      );

      if (!r) return;

      const photos = await getSignedPhotos(r);

      const details = [
        ["Numéro", r.intake_number],
        ["Date", r.received_at],
        ["Client", r.customer_name],
        ["Téléphone", r.customer_phone],
        ["Adresse", r.customer_address],
        ["Véhicule", r.vehicle_name],
        ["Modèle", r.vehicle_model],
        ["Plaque", r.plate_number],
        ["VIN", r.vin_number],
        ["Couleur", r.vehicle_color],
        ["Kilométrage", r.mileage],
        ["Carburant", r.fuel_level],
        ["Plainte du client", r.customer_complaint],
        ["Carrosserie", r.body_condition],
        ["Peinture", r.paint_condition],
        ["Vitres et éclairage", r.glass_condition],
        ["Dommages", r.visible_damage],
        ["Accessoires reçus", r.received_items_notes],
        ["Inspection", r.inspection_notes],
        ["Réceptionnaire", r.receiver_name]
      ];

      const detailsHTML = details.map(item => `
        <p><strong>${escapeHTML(item[0])} :</strong>
        ${escapeHTML(item[1] || "-")}</p>
      `).join("");

      const photosHTML = photos.map(url => `
        <img src="${escapeHTML(url)}"
          style="width:140px;height:110px;object-fit:cover;margin:5px;border-radius:6px;">
      `).join("");

      const area = document.getElementById("intakeDetails");

      if (area) {
        area.innerHTML = `
          <h3>Fiche de réception : ${escapeHTML(r.intake_number || "")}</h3>
          ${detailsHTML}
          <h4>Photos enregistrées (${photos.length})</h4>
          <div>${photosHTML || "Aucune photo disponible."}</div>
          <button type="button" id="intakeDetailPrint">
            Imprimer cette fiche et ses photos
          </button>
        `;

        document.getElementById("intakeDetailPrint")
          .addEventListener("click", () => printIntake(r));
      }
    });
  });

  document.querySelectorAll("[data-intake-print]").forEach(button => {
    button.addEventListener("click", () => {
      const r = rows[Number(button.dataset.intakePrint)];
      if (r) printIntake(r);
    });
  });

  bindForm(async (values, form) => {
    const fileInput = form.querySelector(
      'input[name="intake_photos"]'
    );

    const files = fileInput
      ? Array.from(fileInput.files || [])
      : [];

    if (files.length > 20) {
      notify("Maximum 20 photos par réception.");
      return;
    }

    if (files.some(file => !file.type.startsWith("image/"))) {
      notify("Sélectionne uniquement des fichiers image.");
      return;
    }

    const payload = {
      customer_name: values.customer_name,
      customer_phone: values.customer_phone || null,
      customer_address: values.customer_address || null,
      vehicle_name: values.vehicle_name,
      vehicle_model: values.vehicle_model || null,
      plate_number: values.plate_number || null,
      vin_number: values.vin_number || null,
      vehicle_color: values.vehicle_color || null,
      mileage: values.mileage ? Number(values.mileage) : null,
      fuel_level: values.fuel_level || null,
      customer_complaint: values.customer_complaint || null,
      body_condition: values.body_condition || null,
      paint_condition: values.paint_condition || null,
      glass_condition: values.glass_condition || null,
      visible_damage: values.visible_damage || null,
      received_items_notes: values.received_items_notes || null,
      inspection_notes: values.inspection_notes || null,
      receiver_name: values.receiver_name || null,
      intake_photos: [],
      photo_paths: []
    };

    const saved = await saveRow(TABLES.intakes, payload);
    const uploadedPaths = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(
          /[^a-zA-Z0-9._-]/g, "_"
        );

        const path = "garage/intakes/" + saved.id + "/" +
          Date.now() + "_" + i + "_" + safeName;

        const upload = await db.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false
          });

        if (upload.error) throw upload.error;

        uploadedPaths.push(path);
      }

      if (uploadedPaths.length > 0) {
        const update = await db
          .from(TABLES.intakes)
          .update({
            intake_photos: uploadedPaths,
            photo_paths: uploadedPaths
          })
          .eq("id", saved.id);

        if (update.error) throw update.error;
      }

      notify(
        "Réception enregistrée : " +
        (saved.intake_number || "numéro généré par Supabase") +
        " — " + uploadedPaths.length + " photo(s)."
      );

    } catch (photoError) {
      if (uploadedPaths.length > 0) {
        await db.from(TABLES.intakes)
          .update({
            intake_photos: uploadedPaths,
            photo_paths: uploadedPaths
          })
          .eq("id", saved.id);
      }

      notify(
        "Réception enregistrée, mais problème pendant l'envoi des photos. " +
        uploadedPaths.length + " photo(s) envoyée(s)."
      );
    }

    await showIntakes();
  });
}

  /* =====================================================
     2. DEVIS
  ===================================================== */

  
async function showQuotes() {
  const rows = await getRows(TABLES.quotes, "created_at");

  const makeLine = (category, index) => `
    <div class="cwb-g-card" data-quote-line="${category}">
      <strong>${category === "part" ? "Pièce" : "Produit / réparation"} ${index + 1}</strong>

      <label class="cwb-g-label">
        Désignation
        <input class="cwb-g-input" type="text"
          data-line-name>
      </label>

      <label class="cwb-g-label">
        Quantité
        <input class="cwb-g-input" type="number"
          min="0" step="0.01" value="1" data-line-qty>
      </label>

      <label class="cwb-g-label">
        Prix unitaire (BIF)
        <input class="cwb-g-input" type="number"
          min="0" step="1" value="0" data-line-price>
      </label>

      <p>Montant : <strong data-line-total>0 BIF</strong></p>

      <button type="button" class="cwb-g-button"
        data-remove-line>
        Supprimer cette ligne
      </button>
    </div>
  `;

  const partsHTML = Array.from(
    { length: 5 },
    (_, i) => makeLine("part", i)
  ).join("");

  showPage(`
    ${pageHeader("Devis de réparation",
      "Créer un devis détaillé pour le client.")}

    ${formBox("Nouveau devis", `
      <h3>Informations du client</h3>

      ${field("Nom du client", "customer_name", "text", true)}
      ${field("Téléphone", "customer_phone")}
      ${field("Adresse", "customer_address")}
      ${field("Véhicule", "vehicle_name", "text", true)}
      ${field("Modèle", "vehicle_model")}
      ${field("Plaque", "plate_number")}
      ${field("Couleur", "vehicle_color")}
      ${field("Validité du devis", "validity")}
      ${area("Description des réparations", "repair_description")}

      <h3>1. Pièces à remplacer</h3>
      <div id="quoteParts">${partsHTML}</div>

      <button type="button" class="cwb-g-button"
        id="addQuotePart">
        + Ajouter une pièce
      </button>

      <h3>2. Produits et réparations</h3>
      <div id="quoteProducts">
        ${makeLine("product_repair", 0)}
      </div>

      <button type="button" class="cwb-g-button"
        id="addQuoteProduct">
        + Ajouter un produit ou une réparation
      </button>

      <h3>3. Main-d'œuvre</h3>
      ${field("Montant de la main-d'œuvre (BIF)",
        "labour_amount", "number")}

      <h3>4. Calcul du devis</h3>
      ${field("Remise (BIF)", "discount_amount", "number")}
      <input type="hidden" name="tax_rate" value="18">

      <div class="cwb-g-card">
        <p>Pièces : <strong id="quotePartsTotal">0 BIF</strong></p>
        <p>Produits et réparations :
          <strong id="quoteProductsTotal">0 BIF</strong>
        </p>
        <p>Main-d'œuvre : <strong id="quoteLabourTotal">0 BIF</strong></p>
        <p>Sous-total HT : <strong id="quoteSubtotal">0 BIF</strong></p>
        <p>Remise : <strong id="quoteDiscount">0 BIF</strong></p>
        <p>Montant taxable : <strong id="quoteTaxable">0 BIF</strong></p>
        <p>TVA (18 %) : <strong id="quoteTax">0 BIF</strong></p>
        <h3>Total TTC : <strong id="quoteGrandTotal">0 BIF</strong></h3>
      </div>

      ${area("Notes complémentaires", "notes")}
    `, "Enregistrer le devis")}

    <h3>Ouvrir un devis</h3>

<div class="cwb-g-card">
  <input
    type="text"
    id="quoteSearch"
    class="cwb-g-input"
    placeholder="Numéro du devis ou nom du client..."
  >

  <button
    type="button"
    class="cwb-g-button"
    id="searchQuoteButton"
  >
    🔍 Rechercher un devis
  </button>
</div>
<h3>Devis enregistrés</h3>

${tableBox(
  ["Numéro", "Client", "Véhicule", "Total TTC", "Statut", "Actions"],
  rows.map((r, i) => `
        <tr>
          <td>${escapeHTML(r.quote_number || "")}</td>
          <td>${escapeHTML(r.customer_name || "")}</td>
          <td>${escapeHTML(r.vehicle_name || "")}</td>
          <td>${money(r.total_amount)}</td>
          <td>${escapeHTML(r.status || "En attente")}</td>
          <td>
  <button type="button"
    class="cwb-g-button"
    data-open-quote="${i}">
    Ouvrir
  </button>

  <button type="button"
    class="cwb-g-button"
    data-garage-print="${i}">
    Imprimer
  </button>
</td>
        </tr>
      `)
    )}
  `);
   
const page = root.querySelector("#cwbGaragePage");
const form = page.querySelector(".cwb-g-form");
let editingQuoteId = null;

let partIndex = 5;
let productIndex = 1;

const searchInput = page.querySelector("#quoteSearch");
const searchButton = page.querySelector("#searchQuoteButton");
function filterQuotes() {
  const search = searchInput.value.trim().toLowerCase();

  page.querySelectorAll("tbody tr").forEach(row => {
    row.style.display =
      row.textContent.toLowerCase().includes(search) ? "" : "none";
  });
}

if (searchInput) {
  searchInput.addEventListener("input", filterQuotes);
}

if (searchButton) {
  searchButton.addEventListener("click", filterQuotes);
}
async function openQuote(index) {
  const quote = rows[index];

  if (!quote) {
    notify("Devis introuvable.");
    return;
  }

  editingQuoteId = quote.id;

  form.elements.customer_name.value = quote.customer_name || "";
  form.elements.customer_phone.value = quote.customer_phone || "";
  form.elements.customer_address.value = quote.customer_address || "";
  form.elements.vehicle_name.value = quote.vehicle_name || "";
  form.elements.vehicle_model.value = quote.vehicle_model || "";
  form.elements.plate_number.value = quote.plate_number || "";
  form.elements.vehicle_color.value = quote.vehicle_color || "";
  form.elements.validity.value = quote.validity || "";
  form.elements.repair_description.value = quote.repair_description || "";
  form.elements.labour_amount.value = quote.labour_amount || 0;
  form.elements.discount_amount.value = quote.discount_amount || 0;
  form.elements.notes.value = quote.notes || "";
   
const savedLines = Array.isArray(quote.lines) ? quote.lines : [];

const parts = savedLines.filter(line => line.category === "part");
const products = savedLines.filter(line => line.category === "product_repair");

const partsContainer = page.querySelector("#quoteParts");
const productsContainer = page.querySelector("#quoteProducts");

partsContainer.innerHTML = "";
productsContainer.innerHTML = "";

const partCount = Math.max(5, parts.length);
const productCount = Math.max(1, products.length);

for (let i = 0; i < partCount; i++) {
  partsContainer.insertAdjacentHTML(
    "beforeend",
    makeLine("part", i)
  );
}

for (let i = 0; i < productCount; i++) {
  productsContainer.insertAdjacentHTML(
    "beforeend",
    makeLine("product_repair", i)
  );
}

function fillLines(category, saved) {
  const lineRows = page.querySelectorAll(
    `[data-quote-line="${category}"]`
  );

  saved.forEach((line, index) => {
    const row = lineRows[index];
    if (!row) return;

    row.querySelector("[data-line-name]").value = line.item_name || "";
    row.querySelector("[data-line-qty]").value = line.quantity || 0;
    row.querySelector("[data-line-price]").value = line.unit_price || 0;
  });
}

fillLines("part", parts);
fillLines("product_repair", products);

partIndex = partCount;
productIndex = productCount;

calculateQuote();


  notify("Devis chargé : " + quote.quote_number);
}

page.addEventListener("click", async event => {
  const button = event.target.closest("[data-open-quote]");
  if (!button) return;

  const index = Number(button.dataset.openQuote);

  try {
    await openQuote(index);
  } catch (error) {
    console.error("Erreur ouverture devis :", error);
    notify(
      "Erreur ouverture devis : " + (error.message || error)
    );
  }
});
  const formatMoney = amount =>
    money(Math.round(Number(amount || 0)));
   

  function calculateQuote() {
    const readLines = category => {
      return Array.from(
        form.querySelectorAll(`[data-quote-line="${category}"]`)
      ).map(row => {
        const name = row.querySelector("[data-line-name]").value.trim();
        const quantity = Number(
          row.querySelector("[data-line-qty]").value || 0
        );
        const unitPrice = Number(
          row.querySelector("[data-line-price]").value || 0
        );
        const total = quantity * unitPrice;

        row.querySelector("[data-line-total]").textContent =
          formatMoney(total);

        return {
          category,
          item_name: name,
          quantity,
          unit_price: unitPrice,
          total
        };
      }).filter(line => line.item_name);
    };

    const parts = readLines("part");
    const products = readLines("product_repair");

    const partsTotal = parts.reduce((sum, line) =>
      sum + line.total, 0);

    const productsTotal = products.reduce((sum, line) =>
      sum + line.total, 0);

    const labour = Number(form.elements.labour_amount.value || 0);
    const discount = Number(form.elements.discount_amount.value || 0);

    const subtotal = partsTotal + productsTotal + labour;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * 18 / 100);
    const total = taxable + tax;

    page.querySelector("#quotePartsTotal").textContent =
      formatMoney(partsTotal);

    page.querySelector("#quoteProductsTotal").textContent =
      formatMoney(productsTotal);

    page.querySelector("#quoteLabourTotal").textContent =
      formatMoney(labour);

    page.querySelector("#quoteSubtotal").textContent =
      formatMoney(subtotal);

    page.querySelector("#quoteDiscount").textContent =
      formatMoney(discount);

    page.querySelector("#quoteTaxable").textContent =
      formatMoney(taxable);

    page.querySelector("#quoteTax").textContent =
      formatMoney(tax);

    page.querySelector("#quoteGrandTotal").textContent =
      formatMoney(total);

    return {
      parts,
      products,
      partsTotal,
      productsTotal,
      labour,
      discount,
      subtotal,
      taxable,
      tax,
      total
    };
  }

  page.querySelector("#addQuotePart").addEventListener("click", () => {
    const container = page.querySelector("#quoteParts");
    container.insertAdjacentHTML(
      "beforeend",
      makeLine("part", partIndex++)
    );
    calculateQuote();
  });

  page.querySelector("#addQuoteProduct").addEventListener("click", () => {
    const container = page.querySelector("#quoteProducts");
    container.insertAdjacentHTML(
      "beforeend",
      makeLine("product_repair", productIndex++)
    );
    calculateQuote();
  });

  form.addEventListener("input", event => {
    if (
      event.target.matches("[data-line-name]") ||
      event.target.matches("[data-line-qty]") ||
      event.target.matches("[data-line-price]") ||
      event.target.name === "labour_amount" ||
      event.target.name === "discount_amount"
    ) {
      calculateQuote();
    }
  });

  form.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-line]");
    if (!button) return;

    const line = button.closest("[data-quote-line]");
    if (line) {
      line.remove();
      calculateQuote();
    }
  });

  calculateQuote();

  attachGaragePrintButtons(rows, "quote");

  bindForm(async values => {
    const result = calculateQuote();

    const allLines = [
      ...result.parts,
      ...result.products
    ];

    const invalidLine = allLines.some(line =>
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isFinite(line.unit_price) ||
      line.unit_price < 0
    );

    if (invalidLine) {
      throw new Error(
        "Vérifie les quantités et les prix des lignes du devis."
      );
    }

    if (
      !Number.isFinite(result.labour) || result.labour < 0 ||
      !Number.isFinite(result.discount) || result.discount < 0
    ) {
      throw new Error("Vérifie la main-d'œuvre et la remise.");
    }

    if (result.discount > result.subtotal) {
      throw new Error("La remise ne peut pas dépasser le sous-total.");
    }

    if (!allLines.length && result.labour <= 0) {
      throw new Error("Ajoute au moins une ligne ou un montant de main-d'œuvre.");
    }

    
const quoteValues = {
  customer_name: values.customer_name,
  customer_phone: values.customer_phone || null,
  customer_address: values.customer_address || null,
  vehicle_name: values.vehicle_name,
  vehicle_model: values.vehicle_model || null,
  plate_number: values.plate_number || null,
  vehicle_color: values.vehicle_color || null,
  validity: values.validity || null,
  repair_description: values.repair_description || null,

  lines: allLines,

  parts_amount: result.partsTotal,
  labour_amount: result.labour,
  discount_amount: result.discount,
  subtotal_amount: result.subtotal,
  taxable_amount: result.taxable,
  tax_rate: 18,
  tax_amount: result.tax,
  total_amount: result.total,
  notes: values.notes || null
};

let saved;

if (editingQuoteId) {
  saved = await updateRow(
    TABLES.quotes,
    editingQuoteId,
    quoteValues
  );
} else {
  saved = await saveRow(TABLES.quotes, {
    ...quoteValues,
    quote_date: today()
  });
}

editingQuoteId = null;

notify(
  "Devis enregistré : " +
  (saved.quote_number || "numéro généré par Supabase")
);

  await showQuotes();
});
} 
  /* =====================================================
     3. CONTRE-EXPERTISE ASSURANCE
  ===================================================== */

  async function showInsurance() {
    const rows = await getRows(TABLES.insurance, "created_at");

    showPage(`
      ${pageHeader("Contre-expertise",
        "Enregistrer la décision de l'expert et de l'assurance.")}

      ${formBox("Nouveau dossier d'assurance", `
        ${field("Société d'assurance", "insurance_company", "text", true)}
        ${field("Référence assurance", "insurance_reference")}
        ${field("Nom de l'expert", "expert_name")}
        ${field("Contact de l'expert", "expert_contact")}
        ${field("Date de l'expertise", "review_date", "date")}
        ${field("Devis initial (BIF)", "original_estimate", "number")}
        ${field("Montant approuvé (BIF)", "approved_amount", "number")}
        ${field("Montant rejeté (BIF)", "rejected_amount", "number")}
        ${selectField("Décision", "decision",
          ["En attente", "Approuvé", "Partiellement approuvé", "Refusé"])}
        ${area("Notes de décision", "decision_notes")}
        ${selectField("Statut", "status",
          ["En attente", "En cours", "Terminé"])}
      `, "Enregistrer la contre-expertise")}

      
      <h3>Dossiers enregistrés</h3>
      ${tableBox(
        ["Numéro", "Assurance", "Référence", "Approuvé", "Décision", "Actions"],
        rows.map((r, i) => `
          <tr>
            <td>${escapeHTML(r.review_number || "")}</td>
            <td>${escapeHTML(r.insurance_company || "")}</td>
            <td>${escapeHTML(r.insurance_reference || "")}</td>
            <td>${money(r.approved_amount)}</td>
            <td>${escapeHTML(r.decision || "")}</td>
            <td>
              <button type="button" data-open-insurance="${i}">Ouvrir</button>
              <button type="button" data-print-insurance="${i}">Imprimer</button>
            </td>
          </tr>
        `)
      )}
    `);
     
    bindForm(async values => {
      const saved = await saveRow(TABLES.insurance, {
        insurance_company: values.insurance_company,
        insurance_reference: values.insurance_reference || null,
        expert_name: values.expert_name || null,
        expert_contact: values.expert_contact || null,
        review_date: values.review_date || null,
        original_estimate: Number(values.original_estimate || 0),
        approved_amount: Number(values.approved_amount || 0),
        rejected_amount: Number(values.rejected_amount || 0),
        decision: values.decision,
        decision_notes: values.decision_notes || null,
        status: values.status
      });

      notify("Dossier enregistré : " +
        (saved.review_number || "numéro généré par Supabase"));

      await showInsurance();
    });
  }
  // OUVRIR UNE CONTRE-EXPERTISE
page.addEventListener("click", async event => {
  const button = event.target.closest("[data-open-insurance]");
  if (!button) return;

  const index = Number(button.dataset.openInsurance);
  const rows = await getRows(TABLES.insurance, "created_at");
  const review = rows[index];

  if (!review) {
    notify("Contre-expertise introuvable.", true);
    return;
  }

  notify("Dossier sélectionné : " + (review.review_number || ""));
});

// IMPRIMER UNE CONTRE-EXPERTISE
page.addEventListener("click", async event => {
  const button = event.target.closest("[data-print-insurance]");
  if (!button) return;

  const index = Number(button.dataset.printInsurance);
  const rows = await getRows(TABLES.insurance, "created_at");
  const review = rows[index];

  if (!review) {
    notify("Contre-expertise introuvable.", true);
    return;
  }

  printGarageDocument("insurance", review);
});

  /* =====================================================
     4. ACTIVITES GARAGE
  ===================================================== */

async function showJobs() {
  const rows = await getRows(TABLES.jobs, "Created_at");

  function printJob(type, r) {
    const win = window.open("", "_blank");

    if (!win) {
      notify("Autorise les fenêtres pop-up pour imprimer.", true);
      return;
    }

    const jobNumber = r.job_number || r.Job_number || "";
    const invoiceNumber = r.invoice_number || r.Invoice_number || "";

    
const subtotal = Number(
  r.garage_subtotal_ht ??
  (
    r.parts_cost != null || r.labor_cost != null
      ? Number(r.parts_cost || 0) + Number(r.labor_cost || 0)
      : Number(r.estimated_cost || r.Job_cost || r.cost || 0)
  )
);

const rate = Number(r.garage_tax_rate ?? 0);

const tax = Number(
  r.garage_tax_amount ?? (subtotal * rate / 100)
);

const total = Number(
  r.garage_total_ttc ?? (subtotal + tax)
);

const paid = Number(r.paid_amount || 0);
const balance = Math.max(0, total - paid);

    const money = amount =>
      Number(amount || 0).toLocaleString("fr-FR") + " BIF";

    const date = r.Job_date || r.Created_at || "";

    const title = type === "invoice"
      ? "FACTURE FINALE GARAGE"
      : "FICHE D'ACTIVITÉ GARAGE";

    const financialDetails = `
      <h3>DÉTAIL FINANCIER</h3>
      <p>Sous-total HT : ${money(subtotal)}</p>
      <p>Taux TVA : ${rate}%</p>
      <p>Montant TVA : ${money(tax)}</p>
      <hr>
      <h2>Total TTC : ${money(total)}</h2>
      <p>Montant payé : ${money(paid)}</p>
      <h2>Solde restant : ${money(balance)}</h2>
      <p>Statut paiement : ${escapeHTML(r.Payment_status || "")}</p>
    `;

    const details = type === "invoice"
      ? `
        <h3>DÉTAIL DE LA FACTURE</h3>
        <p>Numéro facture : ${escapeHTML(invoiceNumber)}</p>
        <p>Numéro activité : ${escapeHTML(jobNumber)}</p>
        <p>Description des travaux :<br>
          ${escapeHTML(r.Job_description || r.repaire_descrption || "")}
        </p>
        ${financialDetails}
      `
      : `
        <h3>DÉTAIL DE L'ACTIVITÉ</h3>
        <p>Numéro activité : ${escapeHTML(jobNumber)}</p>
        <p>Numéro facture : ${escapeHTML(invoiceNumber)}</p>
        <p>Description des travaux :<br>
          ${escapeHTML(r.Job_description || r.repaire_descrption || "")}
        </p>
        <p>Mécanicien : ${escapeHTML(r.mechanic_name || r.machanic_name || "")}</p>
        <p>Priorité : ${escapeHTML(r.Priority || "")}</p>
        <p>Statut du travail : ${escapeHTML(r.Job_status || r.status || "")}</p>
        <p>Date prévue de livraison :
          ${escapeHTML(r.estimated_completion_date || "")}
        </p>
        <p>Notes :<br>${escapeHTML(r.Notes || "")}</p>
        ${financialDetails}
      `;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #111;
          }
          h1 {
            text-align: center;
            border-bottom: 2px solid #222;
            padding-bottom: 12px;
          }
          h2 { margin-top: 22px; }
          .company {
            text-align: center;
            margin-bottom: 25px;
          }
          .section {
            margin-top: 20px;
            line-height: 1.7;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 70px;
          }
          .signatures div {
            width: 40%;
            border-top: 1px solid #222;
            padding-top: 8px;
          }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="company">
          <h2>C.W.B System</h2>
          <p>Camel Work and Business company</p>
          <p>Better Quality is our priority</p>
          <p>Bujumbura, Chaussée du Peuple Murundi No. 54</p>
          <p>Tél : 67481564 / 62180032</p>
        </div>

        <h1>${title}</h1>

        <div class="section">
          <p>Client : ${escapeHTML(r.customer_name || "")}</p>
          <p>Téléphone : ${escapeHTML(r.customer_phone || "")}</p>
          <p>Véhicule : ${escapeHTML(r.Vehicle_name || "")}</p>
          <p>Modèle : ${escapeHTML(r.Vehicle_model || "")}</p>
          <p>Plaque : ${escapeHTML(r.Vehicle_plate || "")}</p>
          <p>Date : ${escapeHTML(date)}</p>
        </div>

        <div class="section">
          ${details}
        </div>

        <div class="signatures">
          <div>Signature du client</div>
          <div>Signature C.W.B Garage</div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);

    win.document.close();
  }

  showPage(`
    ${pageHeader("Activités du Garage",
      "Suivre les réparations et les mécaniciens.")}

    ${formBox("Nouvelle activité", `
      ${field("Nom du client", "customer_name", "text", true)}
      ${field("Téléphone du client", "customer_phone")}
      ${field("Véhicule", "Vehicle_name")}
      ${field("Modèle", "Vehicle_model")}
      ${field("Plaque", "Vehicle_plate")}
      ${field("Numéro du devis", "quotation_number")}
      ${area("Description du travail", "Job_description", true)}
      ${field("Nom du mécanicien", "mechanic_name")}
      ${field("Coût des pièces (BIF)", "parts_cost", "number")}
      ${field("Coût main-d'œuvre (BIF)", "labor_cost", "number")}
      ${field("Sous-total HT (BIF)", "estimated_cost", "number")}
      <label class="cwb-g-label">
  Choisir le taux de TVA
  <select class="cwb-g-input"
    name="garage_tax_rate" required>
    <option value="" selected disabled>
      -- Choisir le taux de TVA --
    </option>
    <option value="0">0 % — Sans TVA</option>
    <option value="18">18 % — TVA normale</option>
  </select>
</label>
      ${field("Montant déjà payé (BIF)", "paid_amount", "number")}
      ${field("Date prévue de livraison", "estimated_completion_date", "date")}

      ${selectField("Priorité", "Priority",
        ["Normale", "Urgente", "Très urgente"])}

      ${selectField("Statut du travail", "Job_status",
        ["En attente", "En cours", "Terminé", "Livré"])}

      ${selectField("Paiement", "Payment_status",
        ["Unpaid", "Partially paid", "Paid"])}

      ${area("Notes", "Notes")}
    `, "Enregistrer l'activité")}

    <h3>Activités enregistrées</h3>

    ${tableBox(
      ["N° activité", "N° facture", "Client", "Véhicule", "Statut", "Impression"],
      rows.map((r, i) => `
        <tr>
          <td>${escapeHTML(r.job_number || r.Job_number || "")}</td>
          <td>${escapeHTML(r.invoice_number || r.Invoice_number || "")}</td>
          <td>${escapeHTML(r.customer_name || "")}</td>
          <td>${escapeHTML(r.Vehicle_name || "")}</td>
          <td>${escapeHTML(r.Job_status || r.status || "")}</td>
          <td>
            <button type="button"
              data-job-print="activity"
              data-job-index="${i}">
              🖨️ Fiche
            </button>
            <button type="button"
              data-job-print="invoice"
              data-job-index="${i}">
              🧾 Facture
            </button>
          </td>
        </tr>
      `)
    )}
  `);

  document.querySelectorAll("[data-job-print]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.jobIndex);
      const type = button.dataset.jobPrint;
      const row = rows[index];

      if (!row) {
        notify("Activité introuvable.", true);
        return;
      }

      if (type === "invoice" &&
          !(row.invoice_number || row.Invoice_number)) {
        notify("Cette activité n'a pas encore de numéro de facture.", true);
        return;
      }

      printJob(type, row);
    });
  });

  bindForm(async values => {
    const parts = Number(values.parts_cost || 0);
    const labour = Number(values.labor_cost || 0);
    const subtotalHT = Number(
      values.estimated_cost || parts + labour
    );

    const taxRate = Number(values.garage_tax_rate || 0);

    if (![0, 18].includes(taxRate)) {
      notify("Choisis un taux de TVA de 0 % ou 18 %.", true);
      return;
    }

    if (
      !Number.isFinite(parts) || parts < 0 ||
      !Number.isFinite(labour) || labour < 0 ||
      !Number.isFinite(subtotalHT) || subtotalHT < 0
    ) {
      notify("Vérifie les montants saisis.", true);
      return;
    }

    const taxAmount = Math.round(subtotalHT * taxRate) / 100;
    const totalTTC = subtotalHT + taxAmount;

    const paymentStatus = values.Payment_status || "Unpaid";
    let paidAmount = Number(values.paid_amount || 0);

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      notify("Vérifie le montant payé.", true);
      return;
    }

    if (paymentStatus === "Paid") {
      paidAmount = totalTTC;
    }

    if (paymentStatus === "Unpaid") {
      paidAmount = 0;
    }

    if (paymentStatus === "Partially paid") {
      if (paidAmount <= 0) {
        notify(
          "Saisis le montant réellement reçu pour le paiement partiel.",
          true
        );
        return;
      }

      if (paidAmount > totalTTC) {
        notify(
          "Le montant payé ne peut pas dépasser le total TTC.",
          true
        );
        return;
      }
    }

    const saved = await saveRow(TABLES.jobs, {
      customer_name: values.customer_name,
      customer_phone: values.customer_phone || null,

      Vehicle_name: values.Vehicle_name || null,
      Vehicle_model: values.Vehicle_model || null,
      Vehicle_plate: values.Vehicle_plate || null,

      quotation_number: values.quotation_number || null,

      Job_description: values.Job_description,
      repaire_descrption: values.Job_description,

      mechanic_name: values.mechanic_name || null,
      machanic_name: values.mechanic_name || null,

      parts_cost: parts,
      labor_cost: labour,

      garage_subtotal_ht: subtotalHT,
      garage_tax_rate: taxRate,
      garage_tax_amount: taxAmount,
      garage_total_ttc: totalTTC,

      estimated_cost: totalTTC,
      Job_cost: totalTTC,
      cost: totalTTC,

      paid_amount: paidAmount,

      estimated_completion_date:
        values.estimated_completion_date || null,

      Priority: values.Priority,

      Job_status: values.Job_status,
      status: values.Job_status,

      Payment_status: paymentStatus,

      Notes: values.Notes || null,

      Job_date: today()
    });

    notify(
      "Activité enregistrée. Numéro généré par Supabase : " +
      (saved.job_number || saved.Job_number || "voir la fiche")
    );

    if (typeof window.cwbLoadGarageFinancials === "function") {
      try {
        await window.cwbLoadGarageFinancials();
      } catch (error) {
        console.error("Garage financial update:", error);
      }
    }

    await showJobs();
  });
}


      

  /* =====================================================
     5. FACTURES
  ===================================================== */

  
async function showInvoices() {
  const rows = await getRows(TABLES.jobs, "Created_at");

  const invoices = rows.filter(r =>
    r.invoice_number || r.Invoice_number
  );

  showPage(`
    ${pageHeader("Factures Garage",
      "Les numéros officiels sont générés par Supabase.")}

    ${tableBox(
      ["N° facture", "Client", "Véhicule", "Montant", "Paiement", "Impression"],
      invoices.map((r, i) => `
        <tr>
          <td>${escapeHTML(r.invoice_number || r.Invoice_number)}</td>
          <td>${escapeHTML(r.customer_name || "")}</td>
          <td>${escapeHTML(r.Vehicle_name || "")}</td>
          <td>${money(r.final_coast || r.Job_cost || r.cost)}</td>
          <td>${escapeHTML(r.Payment_status || "")}</td>
          <td>
            <button type="button"
              class="cwb-g-button"
              data-garage-print="${i}">
              🖨️ Imprimer
            </button>
          </td>
        </tr>
      `)
    )}

    <p>
      Pour créer une facture, enregistre d'abord une activité Garage.
      Supabase génère automatiquement son numéro officiel.
    </p>
  `);

  attachGaragePrintButtons(invoices, "invoice");
}


  /* =====================================================
     6. ARCHIVES ET DOCUMENTS
  ===================================================== */

  async function showDocuments() {
    const rows = await getRows(TABLES.documents, "created_at");

    showPage(`
      ${pageHeader("Archives Garage",
        "Télécharger et retrouver les documents.")}

      ${formBox("Ajouter un document", `
        ${selectField("Type de document", "document_type", [
          "Réception",
          "Devis",
          "Contre-expertise",
          "Facture",
          "Photo véhicule",
          "Autre"
        ])}
        ${field("Titre du document", "title", "text", true)}
        ${area("Description", "description")}
        ${field("ID réception (facultatif)", "intake_id")}
        ${field("ID devis (facultatif)", "quotation_id")}
        ${field("ID dossier assurance (facultatif)", "insurance_review_id")}
        ${field("ID activité Garage (facultatif)", "garage_job_id", "number")}
        <label class="cwb-g-label">
          Choisir le fichier
          <input class="cwb-g-input"
            type="file" name="document_file" required>
        </label>
      `, "Téléverser et archiver")}

      <h3>Documents archivés</h3>
      ${tableBox(
        ["N° document", "Type", "Titre", "Fichier", "Date"],
        rows.map(r => `
          <tr>
            <td>${escapeHTML(r.document_number || "")}</td>
            <td>${escapeHTML(r.document_type || "")}</td>
            <td>${escapeHTML(r.title || "")}</td>
            <td>${escapeHTML(r.original_file_name || "")}</td>
            <td>${escapeHTML(r.created_at || "")}</td>
          </tr>
        `)
      )}
    `);

    bindForm(async (values, form) => {
      const file = form.querySelector('[name="document_file"]').files[0];

      if (!file) {
        throw new Error("Choisis un fichier.");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path =
        "garage/" + Date.now() + "_" + safeName;

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) throw uploadError;

      try {
        const saved = await saveRow(TABLES.documents, {
          document_type: values.document_type,
          title: values.title,
          description: values.description || null,
          intake_id: values.intake_id || null,
          quotation_id: values.quotation_id || null,
          insurance_review_id: values.insurance_review_id || null,
          garage_job_id: values.garage_job_id
            ? Number(values.garage_job_id)
            : null,
          storage_path: path,
          original_file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size
        });

        notify("Document archivé : " +
          (saved.document_number || "numéro généré par Supabase"));
      } catch (error) {
        notify(
          "Le fichier a été téléversé, mais son enregistrement a échoué. " +
          "Conserve son nom : " + path,
          true
        );
        throw error;
      }

      await showDocuments();
    });

    addDocumentSearch();
  }

  function addDocumentSearch() {
    const page = root.querySelector("#cwbGaragePage");

    const search = document.createElement("div");
    search.className = "cwb-g-card";
    search.innerHTML = `
      <h3>Rechercher un document</h3>
      <input class="cwb-g-input"
        id="cwbGarageSearch"
        placeholder="Numéro, titre ou nom du fichier">
      <div id="cwbGarageSearchResults"></div>
    `;

    page.appendChild(search);

    const input = search.querySelector("#cwbGarageSearch");

    input.addEventListener("input", async () => {
      const term = input.value.trim().toLowerCase();
      const result = search.querySelector("#cwbGarageSearchResults");

      if (!term) {
        result.innerHTML = "";
        return;
      }

      try {
        const rows = await getRows(TABLES.documents, "created_at");

        const matches = rows.filter(r =>
          [
            r.document_number,
            r.title,
            r.original_file_name,
            r.document_type
          ].some(value =>
            String(value || "").toLowerCase().includes(term)
          )
        );

        result.innerHTML = matches.length
          ? matches.map(r => `
              <div class="cwb-g-card">
                <strong>${escapeHTML(r.document_number || "")}</strong>
                <p>${escapeHTML(r.title || "")}</p>
                <button class="cwb-g-button"
                  type="button"
                  data-open-document="${escapeHTML(r.id)}">
                  Ouvrir le document
                </button>
              </div>
            `).join("")
          : "<p>Aucun document trouvé.</p>";

        result.querySelectorAll("[data-open-document]").forEach(button => {
          button.addEventListener("click", async () => {
            await openDocument(button.dataset.openDocument);
          });
        });

      } catch (error) {
        notify(error.message || error, true);
      }
    });
  }

  async function openDocument(id) {
    const { data, error } = await db
      .from(TABLES.documents)
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    const { data: signed, error: signedError } = await db.storage
      .from(BUCKET)
      .createSignedUrl(data.storage_path, 300);

    if (signedError) throw signedError;

    window.open(signed.signedUrl, "_blank");
  }

  /* =====================================================
     FORMULAIRES
  ===================================================== */

  function bindForm(callback) {
    const form = root.querySelector("#cwbGaragePage .cwb-g-form");

    if (!form) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = "Enregistrement...";

      try {
        const values = Object.fromEntries(
          new FormData(form).entries()
        );

        await callback(values, form);

      } catch (error) {
        console.error(error);
        notify(error.message || "Erreur pendant l'enregistrement.", true);

      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = "Enregistrer";
        }
      }
    });
  }

  /* =====================================================
     INITIALISATION
  ===================================================== */

  window.cwbGarageInit = function () {
    if (!db) {
      alert("Connexion Supabase introuvable. Vérifie le client Supabase.");
      return;
    }

    root = document.getElementById("garage");

    if (!root) {
      console.error("C.W.B Garage : élément #garage introuvable.");
      return;
    }

    renderShell();
    home();

    console.log("C.W.B Garage module initialisé.");
  };

})();
