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
========================================= */

function printGarageDocument(type, r) {

  const documents = {

    intake: {
      title: "FICHE DE RÉCEPTION DU VÉHICULE",
      number: r.intake_number,
      fields: [
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
      ]
    },

    quote: {
      title: "DEVIS DE RÉPARATION",
      number: r.quote_number,
      fields: [
        ["Client", r.customer_name],
        ["Téléphone", r.customer_phone],
        ["Adresse", r.customer_address],
        ["Véhicule", r.vehicle_name],
        ["Modèle", r.vehicle_model],
        ["Plaque", r.plate_number],
        ["Couleur", r.vehicle_color],
        ["Description des réparations", r.repair_description],
        ["Pièces", money(r.parts_amount)],
        ["Main-d'œuvre", money(r.labour_amount)],
        ["Sous-total", money(r.subtotal_amount)],
        ["Remise", money(r.discount_amount)],
        ["TVA", (r.tax_rate || 0) + " %"],
        ["Montant TVA", money(r.tax_amount)],
        ["TOTAL À PAYER", money(r.total_amount)],
        ["Validité", r.validity],
        ["Statut", r.status],
        ["Notes", r.notes]
      ]
    },

    invoice: {
      title: "FACTURE GARAGE",
      number: r.invoice_number || r.Invoice_number,
      fields: [
        ["Client", r.customer_name],
        ["Téléphone", r.customer_phone || r.Customer_phone],
        ["Véhicule", r.Vehicle_name],
        ["Modèle", r.Vehicle_model],
        ["Plaque", r.Vehicle_plate],
        ["Travaux", r.Job_description || r.repaire_descrption],
        ["Mécanicien", r.mechanic_name || r.machanic_name],
        ["Coût des pièces", money(r.parts_cost)],
        ["Main-d'œuvre", money(r.labor_cost)],
        ["TOTAL FACTURE", money(
          r.final_coast || r.Job_cost || r.cost || r.estimated_cost
        )],
        ["Montant payé", money(r.paid_amount)],
        ["Statut paiement", r.Payment_status],
        ["Date", r.Job_date],
        ["Notes", r.Notes]
      ]
    }

  };

  const doc = documents[type];

  if (!doc) return;

  const rows = doc.fields
    .filter(item => item[1] !== null &&
                    item[1] !== undefined &&
                    item[1] !== "")
    .map(item => `
      <tr>
        <th>${escapeHTML(item[0])}</th>
        <td>${escapeHTML(item[1])}</td>
      </tr>
    `).join("");

  const win = window.open("", "_blank");

  if (!win) {
    notify("Autorise les fenêtres pop-up pour imprimer.", true);
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${escapeHTML(doc.title)}</title>

      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 25px;
          color: #222;
        }

        .header {
          text-align: center;
          border-bottom: 3px solid #173b63;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .header h1 {
          color: #b51f2a;
          margin: 0;
        }

        .header p {
          margin: 5px;
        }

        h2 {
          text-align: center;
          margin: 25px 0;
        }

        .number {
          text-align: center;
          font-weight: bold;
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          border: 1px solid #aaa;
          padding: 10px;
          text-align: left;
          vertical-align: top;
        }

        th {
          width: 35%;
          background: #eee;
        }

        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 65px;
          gap: 30px;
        }

        .signatures div {
          width: 45%;
          text-align: center;
          border-top: 1px solid #222;
          padding-top: 10px;
        }

        .footer {
          text-align: center;
          margin-top: 40px;
          font-size: 12px;
        }

        @media print {
          button { display: none; }
          body { padding: 10px; }
        }
      </style>
    </head>

    <body>

      <div class="header">
        <h1>C.W.B SYSTEM</h1>
        <p>Camel Work and Business company</p>
        <strong>Better Quality is our priority</strong>
        <p>Bujumbura, Chaussée du Peuple Murundi No. 54</p>
        <p>Tél : 67481564 / 62180032</p>
        <p>NIF : 4002652933</p>
      </div>

      <h2>${escapeHTML(doc.title)}</h2>

      <div class="number">
        N° : ${escapeHTML(doc.number || "Non disponible")}
      </div>

      <table>
        ${rows}
      </table>

      <div class="signatures">
        <div>Signature du client</div>
        <div>Signature et cachet C.W.B</div>
      </div>

      <div class="footer">
        C.W.B System • Master Version 2
      </div>

      <button onclick="window.print()">
        IMPRIMER LE DOCUMENT
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

    showPage(`
      ${pageHeader("Réception des véhicules",
        "Créer une fiche d'arrivée et d'inspection.")}

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
      `, "Enregistrer la réception")}

      <h3>Réceptions enregistrées</h3>
      ${tableBox(
        ["Numéro", "Client", "Véhicule", "Plaque", "Date"],
        rows.map(r => `
          <tr>
            <td>${escapeHTML(r.intake_number || "En attente")}</td>
            <td>${escapeHTML(r.customer_name)}</td>
            <td>${escapeHTML(r.vehicle_name)}</td>
            <td>${escapeHTML(r.plate_number)}</td>
            <td>${escapeHTML(r.received_at || "")}</td>
          </tr>
        `)
      )}
    `);

    bindForm(async values => {
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
        fuel_level: values.fuel_level,
        customer_complaint: values.customer_complaint || null,
        body_condition: values.body_condition || null,
        paint_condition: values.paint_condition || null,
        glass_condition: values.glass_condition || null,
        visible_damage: values.visible_damage || null,
        received_items_notes: values.received_items_notes || null,
        inspection_notes: values.inspection_notes || null,
        receiver_name: values.receiver_name || null
      };

      const saved = await saveRow(TABLES.intakes, payload);

      notify("Réception enregistrée : " +
        (saved.intake_number || "numéro généré par Supabase"));

      await showIntakes();
    });
  }

  /* =====================================================
     2. DEVIS
  ===================================================== */

  async function showQuotes() {
    const rows = await getRows(TABLES.quotes, "created_at");

    showPage(`
      ${pageHeader("Devis de réparation",
        "Préparer un devis pour le client.")}

      ${formBox("Créer un devis", `
        ${field("Nom du client", "customer_name", "text", true)}
        ${field("Téléphone", "customer_phone")}
        ${field("Adresse", "customer_address")}
        ${field("Véhicule", "vehicle_name", "text", true)}
        ${field("Modèle", "vehicle_model")}
        ${field("Plaque", "plate_number")}
        ${field("Couleur", "vehicle_color")}
        ${field("Validité du devis", "validity")}
        ${area("Description des réparations", "repair_description")}
        ${field("Montant des pièces (BIF)", "parts_amount", "number")}
        ${field("Main-d'œuvre (BIF)", "labour_amount", "number")}
        ${field("Remise (BIF)", "discount_amount", "number")}
        ${field("TVA (%)", "tax_rate", "number")}
        ${area("Notes", "notes")}
      `, "Enregistrer le devis")}

      <h3>Devis enregistrés</h3>
      ${tableBox(
        ["Numéro", "Client", "Véhicule", "Total", "Statut", "Impression"],
        rows.map((r, i) => `
  <tr>
    <td>${escapeHTML(r.quote_number || "")}</td>
    <td>${escapeHTML(r.customer_name)}</td>
    <td>${escapeHTML(r.vehicle_name)}</td>
    <td>${money(r.total_amount)}</td>
    <td>${escapeHTML(r.status)}</td>
    <td>
      <button type="button" data-garage-print="${i}">
        🖨️ Imprimer
      </button>
    </td>
  </tr>
`)
    attachGaragePrintButtons(rows, "quote");
    bindForm(async values => {
      const parts = Number(values.parts_amount || 0);
      const labour = Number(values.labour_amount || 0);
      const discount = Number(values.discount_amount || 0);
      const rate = Number(values.tax_rate || 18);

      const subtotal = parts + labour;
      const taxable = Math.max(0, subtotal - discount);
      const tax = taxable * rate / 100;
      const total = taxable + tax;

      const saved = await saveRow(TABLES.quotes, {
        quote_date: today(),
        customer_name: values.customer_name,
        customer_phone: values.customer_phone || null,
        customer_address: values.customer_address || null,
        vehicle_name: values.vehicle_name,
        vehicle_model: values.vehicle_model || null,
        plate_number: values.plate_number || null,
        vehicle_color: values.vehicle_color || null,
        validity: values.validity || null,
        repair_description: values.repair_description || null,
        parts_amount: parts,
        labour_amount: labour,
        discount_amount: discount,
        subtotal_amount: subtotal,
        taxable_amount: taxable,
        tax_rate: rate,
        tax_amount: tax,
        total_amount: total,
        notes: values.notes || null,
        lines: []
      });

      notify("Devis enregistré : " +
        (saved.quote_number || "numéro généré par Supabase"));

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
        ["Numéro", "Assurance", "Référence", "Approuvé", "Décision"],
        rows.map(r => `
          <tr>
            <td>${escapeHTML(r.review_number || "")}</td>
            <td>${escapeHTML(r.insurance_company || "")}</td>
            <td>${escapeHTML(r.insurance_reference || "")}</td>
            <td>${money(r.approved_amount)}</td>
            <td>${escapeHTML(r.decision || "")}</td>
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

  /* =====================================================
     4. ACTIVITES GARAGE
  ===================================================== */
async function showJobs() {
  const rows = await getRows(TABLES.jobs, "Created_at");

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
      ${field("Coût estimé total (BIF)", "estimated_cost", "number")}
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
      ["N° activité", "N° facture", "Client", "Véhicule", "Statut"],
      rows.map(r => `
        <tr>
          <td>${escapeHTML(r.job_number || r.Job_number || "")}</td>
          <td>${escapeHTML(r.invoice_number || r.Invoice_number || "")}</td>
          <td>${escapeHTML(r.customer_name || "")}</td>
          <td>${escapeHTML(r.Vehicle_name || "")}</td>
          <td>${escapeHTML(r.Job_status || r.status || "")}</td>
        </tr>
      `)
    )}
  `);

  bindForm(async values => {

    const parts = Number(values.parts_cost || 0);
    const labour = Number(values.labor_cost || 0);

    const estimated = Number(
      values.estimated_cost || parts + labour
    );

    const paymentStatus = values.Payment_status || "Unpaid";

    let paidAmount = Number(values.paid_amount || 0);

    if (
      !Number.isFinite(estimated) ||
      estimated < 0 ||
      !Number.isFinite(paidAmount)
    ) {
      notify("Vérifie les montants saisis.", true);
      return;
    }

    // Paid = full invoice amount.
    if (paymentStatus === "Paid") {
      paidAmount = estimated;
    }

    // Unpaid = nothing received.
    if (paymentStatus === "Unpaid") {
      paidAmount = 0;
    }

    // Partial payment = actual amount received.
    if (paymentStatus === "Partially paid") {

      if (paidAmount <= 0) {
        notify(
          "Saisis le montant réellement reçu pour le paiement partiel.",
          true
        );
        return;
      }

      if (paidAmount > estimated) {
        notify(
          "Le montant payé ne peut pas dépasser le coût total.",
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
      estimated_cost: estimated,

      Job_cost: estimated,
      cost: estimated,

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

    // Update Financial Summary after saving the Garage activity.
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
