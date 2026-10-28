/* C.W.B System — Japanese Cars Import
 * Replacement module. Uses existing Supabase tables/RPCs.
 * Does not alter index.html or other modules.
 *
 * Five photo paths and archived-document paths are stored in a
 * reserved metadata block in notes because the existing order table
 * has only one photo_url column.
 */
(function () {
  "use strict";

  const TABLE = "cwb_japan_import_orders";
  const PAYMENTS = "cwb_japan_customer_payments";
  const RECEIPTS = "cwb_japan_commission_receipts";
  const BUCKET = "Japanese_cars";
  const PHOTO_COUNT = 5;
  const META_START = "\n\n[CWB_JAPAN_PRIVATE_FILES]";
  const META_END = "[/CWB_JAPAN_PRIVATE_FILES]";

  let currentOrders = [];
  let selectedOrder = null;

  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

  const money = (v) => "$" + Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const client = () =>
    window.cwbSupabaseClient || window.supabaseClient || null;

  const byId = (id) => document.getElementById(id);

  function notice(message, isError) {
    const el = byId("jciMessage");
    if (!el) {
      alert(message);
      return;
    }

    el.textContent = message;
    el.style.display = "block";
    el.style.background = isError ? "#fef2f2" : "#ecfdf5";
    el.style.color = isError ? "#991b1b" : "#065f46";
  }

  function getNotesParts(notes) {
    const source = String(notes || "");
    const start = source.lastIndexOf(META_START);

    if (start < 0) {
      return {
        notes: source,
        files: { photos: [], documents: [] }
      };
    }

    const end = source.indexOf(META_END, start);

    if (end < 0) {
      return {
        notes: source,
        files: { photos: [], documents: [] }
      };
    }

    let files = { photos: [], documents: [] };

    try {
      files = JSON.parse(
        source.slice(start + META_START.length, end)
      );
    } catch (_) {}

    return {
      notes: source.slice(0, start).trim(),
      files: {
        photos: Array.isArray(files.photos) ? files.photos : [],
        documents: Array.isArray(files.documents) ? files.documents : []
      }
    };
  }

  function withFiles(notes, files) {
    return String(notes || "").trim() +
      META_START +
      JSON.stringify(files) +
      META_END;
  }

  function mount() {
    if (byId("japanCarImportModule")) return;

    const section = document.createElement("section");
    section.id = "japanCarImportModule";
    section.className = "card hidden";

    section.innerHTML = `
      <style>
        #japanCarImportModule .jci-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(190px,1fr));
          gap: 11px;
        }

        #japanCarImportModule label {
          display: block;
          font-weight: bold;
          font-size: 13px;
          margin: 7px 0 4px;
        }

        #japanCarImportModule input,
        #japanCarImportModule select,
        #japanCarImportModule textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          box-sizing: border-box;
        }

        #japanCarImportModule textarea {
          min-height: 70px;
        }

        #japanCarImportModule .jci-actions {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          margin: 12px 0;
        }

        #japanCarImportModule .jci-btn {
          border: 0;
          border-radius: 7px;
          padding: 10px 13px;
          background: #b91c1c;
          color: white;
          font-weight: bold;
        }

        #japanCarImportModule .jci-btn.dark {
          background: #111827;
        }

        #japanCarImportModule .jci-table {
          overflow: auto;
          margin-top: 12px;
        }

        #japanCarImportModule table {
          border-collapse: collapse;
          width: 100%;
          min-width: 850px;
        }

        #japanCarImportModule th,
        #japanCarImportModule td {
          border: 1px solid #e5e7eb;
          padding: 8px;
          font-size: 12px;
          text-align: left;
        }

        #japanCarImportModule th {
          background: #111827;
          color: #fff;
        }

        #japanCarImportModule .jci-photo-preview {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        #japanCarImportModule .jci-photo-preview img {
          width: 95px;
          height: 72px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid #ddd;
        }

        #japanCarImportModule .jci-subpanel {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px;
          margin-top: 14px;
        }

        #japanCarImportModule .jci-muted {
          font-size: 12px;
          color: #6b7280;
        }

        @media(max-width:600px) {
          #japanCarImportModule .jci-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <h2>Japanese Cars Import</h2>
      <p>Vehicle records, five gallery photos, private documents,
      customer payments, commission and DHL tracking.</p>

      <div id="jciMessage"
        style="display:none;padding:10px;border-radius:7px;margin:10px 0">
      </div>

      <form id="jciOrderForm">
        <input type="hidden" id="jciOrderId">

        <div class="jci-grid">
          <div>
            <label>Order Number</label>
            <input id="jciOrderNo" readonly
              placeholder="Generated by Supabase">
          </div>

          <div>
            <label>Customer Name *</label>
            <input id="jciCustomer" required>
          </div>

          <div>
            <label>Customer Phone</label>
            <input id="jciPhone" inputmode="tel">
          </div>

          <div>
            <label>Car Make / Brand *</label>
            <input id="jciMake" required placeholder="Toyota, Honda...">
          </div>

          <div>
            <label>Year</label>
            <input id="jciYear" type="number" min="1950" max="2100">
          </div>

          <div>
            <label>Chassis Number / VIN *</label>
            <input id="jciVin" required autocomplete="off">
          </div>

          <div>
            <label>Supplier</label>
            <input id="jciSupplier">
          </div>

          <div>
            <label>Vehicle Price (USD)</label>
            <input id="jciPrice" type="number" min="0"
              step="0.01" value="0">
          </div>

          <div>
            <label>Bank Fees (USD)</label>
            <input id="jciBankFee" type="number" min="0"
              step="0.01" value="0">
          </div>

          <div>
            <label>Shipping (USD)</label>
            <input id="jciShipping" type="number" min="0"
              step="0.01" value="0">
          </div>

          <div>
            <label>Customs / Clearing (USD)</label>
            <input id="jciClearing" type="number" min="0"
              step="0.01" value="0">
          </div>

          <div>
            <label>Vehicle Status</label>
            <select id="jciVehicleStatus">
              <option>Ordered</option>
              <option>Purchased</option>
              <option>Shipped</option>
              <option>Arrived in Burundi</option>
              <option>Delivered</option>
            </select>
          </div>

          <div>
            <label>DHL Status</label>
            <select id="jciDhlStatus">
              <option>Not dispatched</option>
              <option>In transit</option>
              <option>Received in Burundi</option>
            </select>
          </div>

          <div class="full">
            <label>Notes</label>
            <textarea id="jciNotes"></textarea>
          </div>
        </div>

        <div class="jci-subpanel">
          <h3>Five Car Photos — choose from your phone gallery</h3>
          <p class="jci-muted">
            Select five photos. On a phone, the picker may let you
            choose Gallery or Camera. Each photo must be JPG, PNG
            or WebP, maximum 5 MB.
          </p>

          <label>Photos (5 required for a new car)</label>
          <input id="jciPhotos" type="file"
            accept="image/jpeg,image/png,image/webp" multiple>

          <div id="jciPhotoPreview" class="jci-photo-preview"></div>
          <div class="jci-muted" id="jciExistingPhotos"></div>
        </div>

        <div class="jci-subpanel">
          <h3>Vehicle Documents / Archive</h3>
          <p class="jci-muted">
            Upload invoices, quotations, bank proofs and other
            documents to the private Japanese_cars bucket.
          </p>

          <label>Choose documents or PDF files</label>
          <input id="jciDocuments" type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple>

          <div id="jciExistingDocs" class="jci-muted"></div>
        </div>

        <div class="jci-actions">
          <button class="jci-btn" type="submit">
            Save Vehicle Record
          </button>
          <button class="jci-btn dark" type="button" id="jciNew">
            New / Clear
          </button>
          <button class="jci-btn dark" type="button" id="jciRefresh">
            Refresh Records
          </button>
        </div>
      </form>

      <div class="jci-subpanel">
        <h3>Find a Vehicle / File</h3>

        <div class="jci-grid">
          <div>
            <label>Search by order number, customer or chassis / VIN</label>
            <input id="jciSearch"
              placeholder="CWB-JI... / customer / VIN">
          </div>

          <div style="align-self:end">
            <button class="jci-btn dark" type="button" id="jciSearchBtn">
              Search
            </button>
          </div>
        </div>

        <div class="jci-table">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>VIN / Chassis</th>
                <th>Total Cost</th>
                <th>DHL</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="jciRows"></tbody>
          </table>
        </div>
      </div>

      <div class="jci-subpanel">
        <h3>Customer Payments</h3>

        <div class="jci-grid">
          <div>
            <label>Payment Amount (USD) *</label>
            <input id="jciPayAmount" type="number"
              min="0.01" step="0.01">
          </div>

          <div>
            <label>Method *</label>
            <select id="jciPayMethod">
              <option>Bank</option>
              <option>Cash</option>
              <option>Mobile Money</option>
              <option>Card</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label>Reference</label>
            <input id="jciPayReference">
          </div>
        </div>

        <div class="jci-actions">
          <button class="jci-btn" type="button" id="jciClaimPayment">
            Record Payment Claim
          </button>
          <button class="jci-btn dark" type="button" id="jciLoadPayments">
            Show Payment History
          </button>
        </div>

        <div id="jciPayments" class="jci-table"></div>
      </div>

      <div class="jci-subpanel">
        <h3>CEO Controls — Discount and Commission</h3>
        <p class="jci-muted">
          Standard commission: USD 100. Discount requires CEO
          authorization and a reason. Commission can be received
          only after DHL is marked received in Burundi.
        </p>

        <div class="jci-grid">
          <div>
            <label>Discount (USD, 0–100)</label>
            <input id="jciDiscount" type="number"
              min="0" max="100" step="0.01" value="0">
          </div>

          <div>
            <label>Reason for discount</label>
            <input id="jciDiscountReason">
          </div>

          <div>
            <label>Commission receipt amount (USD)</label>
            <input id="jciCommissionAmount" type="number"
              min="0.01" step="0.01">
          </div>

          <div>
            <label>Commission receipt reference</label>
            <input id="jciCommissionReference">
          </div>
        </div>

        <div class="jci-actions">
          <button class="jci-btn" type="button" id="jciDiscountBtn">
            Authorize Discount (CEO)
          </button>
          <button class="jci-btn dark" type="button" id="jciCommissionBtn">
            Record Commission Receipt (CEO)
          </button>
          <button class="jci-btn dark" type="button" id="jciPrint">
            Print Vehicle File / Invoice
          </button>
        </div>

        <div id="jciCommissionHistory" class="jci-table"></div>
      </div>
    `;

    const dashboard = document.querySelector(".container");
    if (dashboard) dashboard.appendChild(section);
    else document.body.appendChild(section);

    const dashboardGrid = document.querySelector(".dashboard");

    if (dashboardGrid && !byId("japanimportNav")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "module";
      button.id = "japanimportNav";
      button.textContent = "Japanese Cars Import";
      button.onclick = () =>
        window.showModule
          ? window.showModule("japanimport")
          : showPanel();

      dashboardGrid.appendChild(button);
    }

    byId("jciOrderForm").addEventListener("submit", saveOrder);
    byId("jciPhotos").addEventListener("change", previewPhotos);
    byId("jciSearchBtn").onclick = () => loadOrders();
    byId("jciRefresh").onclick = () => loadOrders(true);
    byId("jciNew").onclick = clearForm;
    byId("jciClaimPayment").onclick = claimPayment;
    byId("jciLoadPayments").onclick = loadPayments;
    byId("jciDiscountBtn").onclick = authorizeDiscount;
    byId("jciCommissionBtn").onclick = recordCommission;
    byId("jciPrint").onclick = printFile;

    loadOrders(true);
  }

  function showPanel() {
    document.querySelectorAll(".container > .card").forEach(el => {
      el.classList.add("hidden");
    });

    const panel = byId("japanCarImportModule");

    if (panel) {
      panel.classList.remove("hidden");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function isCEO() {
    const text = (document.body.innerText || "").toUpperCase();
    return text.includes("CEO");
  }

  async function uploadFile(file, orderKey, category, index) {
    const sb = client();

    if (!sb) {
      throw new Error("Supabase is not connected. Please sign in first.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error(file.name + " is over 5 MB.");
    }

    const allowed = category === "photos"
      ? ["image/jpeg", "image/png", "image/webp"]
      : [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf"
        ];

    if (!allowed.includes(file.type)) {
      throw new Error("Unsupported file type: " + file.name);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path =
      `${orderKey}/${category}/${Date.now()}_${index}_${safeName}`;

    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type
    });

    if (error) throw error;

    return {
      path,
      name: file.name,
      type: file.type,
      size: file.size,
      category
    };
  }

  async function signedUrl(path) {
    const sb = client();
    const { data, error } =
      await sb.storage.from(BUCKET).createSignedUrl(path, 300);

    if (error) throw error;
    return data.signedUrl;
  }

  function previewPhotos() {
    const files = Array.from(byId("jciPhotos").files || []);
    const preview = byId("jciPhotoPreview");

    preview.innerHTML = "";

    files.slice(0, PHOTO_COUNT).forEach(file => {
      if (!file.type.startsWith("image/")) return;

      const img = document.createElement("img");
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    });

    if (files.length > PHOTO_COUNT) {
      notice("Choose no more than five photos.", true);
    } else {
      notice(
        files.length
          ? `${files.length} photo(s) selected.`
          : "No new photos selected.",
        false
      );
    }
  }

  async function saveOrder(event) {
    event.preventDefault();

    const sb = client();

    if (!sb) {
      return notice(
        "Supabase is not connected. Sign in and check window.cwbSupabaseClient.",
        true
      );
    }

    const id = byId("jciOrderId").value || null;
    const photoFiles = Array.from(byId("jciPhotos").files || []);
    const documentFiles = Array.from(byId("jciDocuments").files || []);

    if (photoFiles.length > PHOTO_COUNT) {
      return notice("Please select no more than five photos.", true);
    }

    if (!id && photoFiles.length !== PHOTO_COUNT) {
      return notice(
        "Please select exactly five photos for a new vehicle.",
        true
      );
    }

    if (id && photoFiles.length &&
        photoFiles.length !== PHOTO_COUNT) {
      return notice(
        "When replacing photos, select all five photos.",
        true
      );
    }

    const existing = id
      ? currentOrders.find(o => o.id === id)
      : null;

    const parsed = getNotesParts(existing?.notes || "");
    let files = parsed.files;
    const vin = byId("jciVin").value.trim();

    if (!vin) {
      return notice("Chassis number / VIN is required.", true);
    }

    const payload = {
      customer: byId("jciCustomer").value.trim(),
      phone: byId("jciPhone").value.trim() || null,
      make: byId("jciMake").value.trim(),
      year: byId("jciYear").value
        ? Number(byId("jciYear").value)
        : null,
      vin,
      supplier: byId("jciSupplier").value.trim() || null,
      price: Number(byId("jciPrice").value || 0),
      bank_fee: Number(byId("jciBankFee").value || 0),
      shipping: Number(byId("jciShipping").value || 0),
      clearing: Number(byId("jciClearing").value || 0),
      vehicle_status: byId("jciVehicleStatus").value,
      dhl_status: byId("jciDhlStatus").value,
      updated_at: new Date().toISOString()
    };

    if (
      existing &&
      payload.dhl_status === "Received in Burundi" &&
      existing.dhl_status !== payload.dhl_status &&
      !isCEO()
    ) {
      return notice(
        "Only the CEO can mark DHL documents as received in Burundi.",
        true
      );
    }

    notice("Saving record and private files…", false);

try {
  let result;
  let orderKey = id;

  if (!id) {
    // Create the order first so its real ID exists in Supabase.
    payload.photo_url = null;
    payload.notes = withFiles(byId("jciNotes").value, files);

    result = await sb.from(TABLE)
      .insert(payload)
      .select()
      .single();

    if (result.error) throw result.error;

    orderKey = result.data.id;
  }

  // Upload photos only after the order exists.
  if (photoFiles.length) {
    const uploadedPhotos = [];

    for (let i = 0; i < photoFiles.length; i++) {
      uploadedPhotos.push(
        await uploadFile(
          photoFiles[i],
          orderKey,
          "photos",
          i + 1
        )
      );
    }

    files.photos = uploadedPhotos;
  }

  if (documentFiles.length) {
    const uploadedDocs = [];

    for (let i = 0; i < documentFiles.length; i++) {
      uploadedDocs.push(
        await uploadFile(
          documentFiles[i],
          orderKey,
          "documents",
          i + 1
        )
      );
    }

    files.documents = [...files.documents, ...uploadedDocs];
  }

  payload.photo_url = files.photos[0]?.path ||
    existing?.photo_url || null;

  payload.notes = withFiles(byId("jciNotes").value, files);

  if (id) {
    result = await sb.from(TABLE)
      .update(payload)
      .eq("id", id)
      .select()
      .single();
  } else {
    // Save the uploaded file paths against the new order.
    result = await sb.from(TABLE)
      .update({
        photo_url: payload.photo_url,
        notes: payload.notes,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderKey)
      .select()
      .single();
  }

  if (result.error) throw result.error;

  selectedOrder = result.data;
  notice("Vehicle record saved successfully.", false);

  await loadOrders(true);
  await selectOrder(result.data.id);

    } catch (err) {
      console.error("Japanese Cars Import save error:", err);

      notice(
        "Could not save: " +
        (err.message || String(err)) +
        ". Check Supabase table grants and private-bucket policies.",
        true
      );
    }
  }

  async function loadOrders(showAll) {
    const sb = client();

    if (!sb) {
      return notice("Supabase is not connected. Please sign in first.", true);
    }

    const q = (byId("jciSearch")?.value || "").trim().toLowerCase();

    try {
      const { data, error } = await sb.from(TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      currentOrders = data || [];

      const filtered = q
        ? currentOrders.filter(o =>
            [
              o.order_no,
              o.customer,
              o.phone,
              o.make,
              o.vin,
              o.supplier
            ].some(v => String(v || "").toLowerCase().includes(q))
          )
        : currentOrders;

      byId("jciRows").innerHTML = filtered.map(o => {
        const total =
          Number(o.price || 0) +
          Number(o.bank_fee || 0) +
          Number(o.shipping || 0) +
          Number(o.clearing || 0);

        return `
          <tr>
            <td>${esc(o.order_no)}</td>
            <td>${esc(o.customer)}</td>
            <td>${esc(o.make)} ${esc(o.year || "")}</td>
            <td>${esc(o.vin)}</td>
            <td>${money(total)}</td>
            <td>${esc(o.dhl_status)}</td>
            <td>
              <button class="jci-btn dark" type="button"
                onclick="window.cwbJapanCarImportOpen('${o.id}')">
                Open
              </button>
            </td>
          </tr>`;
      }).join("") ||
        `<tr><td colspan="7">No matching vehicle records.</td></tr>`;

      if (showAll) {
        notice(`Loaded ${filtered.length} vehicle record(s).`, false);
      }

    } catch (err) {
      console.error(err);
      notice(
        "Could not load records: " + (err.message || String(err)),
        true
      );
    }
  }

  async function selectOrder(id) {
    const order =
      currentOrders.find(o => o.id === id) || selectedOrder;

    if (!order) return;

    selectedOrder = order;
    const p = getNotesParts(order.notes);

    byId("jciOrderId").value = order.id;
    byId("jciOrderNo").value = order.order_no || "";
    byId("jciCustomer").value = order.customer || "";
    byId("jciPhone").value = order.phone || "";
    byId("jciMake").value = order.make || "";
    byId("jciYear").value = order.year || "";
    byId("jciVin").value = order.vin || "";
    byId("jciSupplier").value = order.supplier || "";
    byId("jciPrice").value = order.price || 0;
    byId("jciBankFee").value = order.bank_fee || 0;
    byId("jciShipping").value = order.shipping || 0;
    byId("jciClearing").value = order.clearing || 0;
    byId("jciVehicleStatus").value = order.vehicle_status || "Ordered";
    byId("jciDhlStatus").value = order.dhl_status || "Not dispatched";
    byId("jciNotes").value = p.notes;

    byId("jciExistingPhotos").textContent =
      `${p.files.photos.length} archived photo(s). ` +
      "Selecting five new photos replaces the existing five.";

    byId("jciExistingDocs").textContent =
      `${p.files.documents.length} archived document(s).`;

    await renderPrivateFiles(p.files);
    await loadPayments();
    await loadCommissionHistory();

    notice("Opened " + (order.order_no || "vehicle record") + ".", false);
  }

  async function renderPrivateFiles(files) {
    const photoBox = byId("jciPhotoPreview");
    const docBox = byId("jciExistingDocs");

    photoBox.innerHTML = "";

    for (const file of files.photos) {
      try {
        const url = await signedUrl(file.path);
        const img = document.createElement("img");

        img.src = url;
        img.alt = file.name || "Vehicle photo";

        photoBox.appendChild(img);
      } catch (_) {}
    }

    const links = [];

    for (const file of files.documents) {
      try {
        const url = await signedUrl(file.path);

        links.push(
          `<div><a href="${esc(url)}" target="_blank" rel="noopener">` +
          `${esc(file.name || file.path)}</a></div>`
        );
      } catch (_) {
        links.push(
          `<div>${esc(file.name || file.path)} ` +
          "(private file; access unavailable)</div>"
        );
      }
    }

    docBox.innerHTML =
      `${files.documents.length} archived document(s).` +
      links.join("");
  }

  function clearForm() {
    byId("jciOrderForm").reset();
    byId("jciOrderId").value = "";
    byId("jciOrderNo").value = "";
    byId("jciPrice").value = "0";
    byId("jciBankFee").value = "0";
    byId("jciShipping").value = "0";
    byId("jciClearing").value = "0";
    byId("jciVehicleStatus").value = "Ordered";
    byId("jciDhlStatus").value = "Not dispatched";
    byId("jciPhotoPreview").innerHTML = "";
    byId("jciExistingPhotos").textContent = "";
    byId("jciExistingDocs").textContent = "";
    selectedOrder = null;
    byId("jciPayments").innerHTML = "";
    byId("jciCommissionHistory").innerHTML = "";

    notice("Ready for a new vehicle.", false);
  }

  async function claimPayment() {
    const sb = client();

    if (!sb) return notice("Supabase is not connected.", true);
    if (!selectedOrder) {
      return notice("Open a vehicle record first.", true);
    }

    const amount = Number(byId("jciPayAmount").value);

    if (!(amount > 0)) {
      return notice("Enter a payment amount greater than zero.", true);
    }

    try {
      const { error } = await sb.from(PAYMENTS).insert({
        order_id: selectedOrder.id,
        amount,
        method: byId("jciPayMethod").value,
        reference: byId("jciPayReference").value.trim() || null
      });

      if (error) throw error;

      byId("jciPayAmount").value = "";
      byId("jciPayReference").value = "";

      notice(
        "Payment claim recorded as PENDING. CEO must confirm it after verification.",
        false
      );

      await loadPayments();

    } catch (err) {
      notice(
        "Payment claim failed: " + (err.message || String(err)),
        true
      );
    }
  }

  async function loadPayments() {
    const sb = client();

    if (!sb || !selectedOrder) return;

    try {
      const { data, error } = await sb.from(PAYMENTS)
        .select("*")
        .eq("order_id", selectedOrder.id)
        .order("claimed_at", { ascending: false });

      if (error) throw error;

      byId("jciPayments").innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Status</th>
              <th>CEO Action</th>
            </tr>
          </thead>
          <tbody>
            ${(data || []).map(p => `
              <tr>
                <td>${esc(p.claimed_at
                  ? new Date(p.claimed_at).toLocaleString()
                  : "")}</td>
                <td>${money(p.amount)}</td>
                <td>${esc(p.method)}</td>
                <td>${esc(p.reference)}</td>
                <td>${esc(p.status)}</td>
                <td>
                  ${p.status === "PENDING" && isCEO()
                    ? `<button class="jci-btn" type="button"
                         onclick="window.cwbJapanCarImportPayment('${p.id}','confirm')">
                         Confirm
                       </button>
                       <button class="jci-btn dark" type="button"
                         onclick="window.cwbJapanCarImportPayment('${p.id}','reject')">
                         Reject
                       </button>`
                    : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;

    } catch (err) {
      notice(
        "Payment history failed: " + (err.message || String(err)),
        true
      );
    }
  }

  async function paymentAction(id, action) {
    const sb = client();

    try {
      if (!isCEO()) {
        throw new Error("Only the CEO may confirm or reject payments.");
      }

      if (action === "confirm") {
        const { error } = await sb.rpc(
          "cwb_japan_confirm_customer_payment",
          { p_payment_id: id }
        );

        if (error) throw error;

      } else {
        const reason =
          prompt("Reason for rejecting this payment (optional):") || "";

        const { error } = await sb.rpc(
          "cwb_japan_reject_customer_payment",
          {
            p_payment_id: id,
            p_reason: reason
          }
        );

        if (error) throw error;
      }

      notice(
        "Payment claim " +
        (action === "confirm" ? "confirmed" : "rejected") +
        ".",
        false
      );

      await loadPayments();

    } catch (err) {
      notice(
        "Payment action failed: " + (err.message || String(err)),
        true
      );
    }
  }

  async function authorizeDiscount() {
    const sb = client();

    if (!sb) return notice("Supabase is not connected.", true);
    if (!selectedOrder) {
      return notice("Open a vehicle record first.", true);
    }
    if (!isCEO()) {
      return notice("Only the CEO may authorize a commission discount.", true);
    }

    const discount = Number(byId("jciDiscount").value || 0);
    const reason = byId("jciDiscountReason").value.trim();

    if (discount > 0 && !reason) {
      return notice("Enter a reason for the discount.", true);
    }

    try {
      const { error } = await sb.rpc(
        "cwb_japan_authorize_discount",
        {
          p_order_id: selectedOrder.id,
          p_discount: discount,
          p_reason: reason || null
        }
      );

      if (error) throw error;

      notice("CEO discount authorized.", false);

      await loadOrders(true);
      await selectOrder(selectedOrder.id);

    } catch (err) {
      notice("Discount failed: " + (err.message || String(err)), true);
    }
  }

  async function recordCommission() {
    const sb = client();

    if (!sb) return notice("Supabase is not connected.", true);
    if (!selectedOrder) {
      return notice("Open a vehicle record first.", true);
    }
    if (!isCEO()) {
      return notice("Only the CEO may record a commission receipt.", true);
    }

    const amount = Number(byId("jciCommissionAmount").value);

    if (!(amount > 0)) {
      return notice("Enter a commission amount greater than zero.", true);
    }

    try {
      const { data: order, error: orderError } = await sb.from(TABLE)
        .select("*")
        .eq("id", selectedOrder.id)
        .single();

      if (orderError) throw orderError;

      if (order.dhl_status !== "Received in Burundi") {
        throw new Error(
          "Commission is payable only after DHL is received in Burundi."
        );
      }

      const { error } = await sb.rpc(
        "cwb_japan_record_commission_receipt",
        {
          p_order_id: selectedOrder.id,
          p_amount: amount,
          p_reference:
            byId("jciCommissionReference").value.trim() || null
        }
      );

      if (error) throw error;

      byId("jciCommissionAmount").value = "";
      byId("jciCommissionReference").value = "";

      notice("Commission receipt recorded.", false);
      await loadCommissionHistory();

    } catch (err) {
      notice(
        "Commission receipt failed: " + (err.message || String(err)),
        true
      );
    }
  }

  async function loadCommissionHistory() {
    const sb = client();

    if (!sb || !selectedOrder || !isCEO()) return;

    try {
      const { data, error } = await sb.from(RECEIPTS)
        .select("*")
        .eq("order_id", selectedOrder.id)
        .order("received_at", { ascending: false });

      if (error) throw error;

      byId("jciCommissionHistory").innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Amount</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            ${(data || []).map(r => `
              <tr>
                <td>${esc(r.received_at
                  ? new Date(r.received_at).toLocaleString()
                  : "")}</td>
                <td>${money(r.amount)}</td>
                <td>${esc(r.reference)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;

    } catch (err) {
      notice(
        "Commission history failed: " + (err.message || String(err)),
        true
      );
    }
  }

  async function printFile() {
    if (!selectedOrder) {
      return notice("Open a vehicle record first.", true);
    }

    const o = selectedOrder;
    const parts = getNotesParts(o.notes);
    const imageUrls = [];

    for (const file of parts.files.photos) {
      try {
        imageUrls.push(await signedUrl(file.path));
      } catch (_) {}
    }

    const documentUrls = [];

    for (const file of parts.files.documents) {
      try {
        documentUrls.push({
          name: file.name,
          url: await signedUrl(file.path)
        });
      } catch (_) {}
    }

    const total =
      Number(o.price || 0) +
      Number(o.bank_fee || 0) +
      Number(o.shipping || 0) +
      Number(o.clearing || 0);

    const w = window.open("", "_blank");

    if (!w) {
      return notice("Allow pop-ups to print the vehicle file.", true);
    }

    w.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${esc(o.order_no)} - C.W.B</title>
        <style>
          body {
            font: 14px Arial;
            padding: 24px;
            color: #111;
          }
          h1 { color: #b91c1c; }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td, th {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: left;
          }
          .photos {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .photos img {
            max-width: 100%;
            height: 230px;
            object-fit: contain;
          }
          .page { page-break-before: always; }
          small { color: #555; }
        </style>
      </head>
      <body>
        <h1>C.W.B System — Japanese Cars Import</h1>

        <p>
          <b>Order:</b> ${esc(o.order_no)}
          &nbsp;
          <b>Date:</b> ${esc(o.created_at
            ? new Date(o.created_at).toLocaleDateString()
            : "")}
        </p>

        <table>
          <tr>
            <th>Customer</th><td>${esc(o.customer)}</td>
            <th>Phone</th><td>${esc(o.phone)}</td>
          </tr>
          <tr>
            <th>Vehicle</th>
            <td>${esc(o.make)} ${esc(o.year)}</td>
            <th>Chassis / VIN</th><td>${esc(o.vin)}</td>
          </tr>
          <tr>
            <th>Supplier</th><td>${esc(o.supplier)}</td>
            <th>DHL</th><td>${esc(o.dhl_status)}</td>
          </tr>
          <tr>
            <th>Vehicle price</th><td>${money(o.price)}</td>
            <th>Bank fees</th><td>${money(o.bank_fee)}</td>
          </tr>
          <tr>
            <th>Shipping</th><td>${money(o.shipping)}</td>
            <th>Customs / clearing</th><td>${money(o.clearing)}</td>
          </tr>
          <tr>
            <th>Total cost</th>
            <td colspan="3"><b>${money(total)}</b></td>
          </tr>
          <tr>
            <th>Commission standard</th>
            <td>${money(o.commission_standard)}</td>
            <th>Discount</th><td>${money(o.commission_discount)}</td>
          </tr>
          <tr>
            <th>Commission final</th>
            <td colspan="3">${money(o.commission_final)}</td>
          </tr>
        </table>

        <h3>Notes</h3>
        <p>${esc(parts.notes)}</p>

        <h2>Vehicle Photos</h2>
        <div class="photos">
          ${imageUrls.map((u, i) => `
            <div>
              <p>Photo ${i + 1}</p>
              <img src="${esc(u)}">
            </div>
          `).join("")}
        </div>

        <div class="page">
          <h2>Archived Documents</h2>
          ${documentUrls.map(d => `
            <p>${esc(d.name)} — ${esc(d.url)}</p>
          `).join("")}
          <p>
            <small>Private C.W.B vehicle file. Print or save as PDF.</small>
          </p>
        </div>

        <script>
          window.onload = () => setTimeout(() => window.print(), 500);
        <\/script>
      </body>
      </html>
    `);

    w.document.close();
  }

  window.cwbJapanCarImportOpen = async (id) => {
    await selectOrder(id);
    showPanel();
  };

  window.cwbJapanCarImportPayment = paymentAction;
  window.cwbJapanCarImportShow = showPanel;
  window.cwbJapanCarImportDiscount = authorizeDiscount;
  window.cwbJapanCarImportCommissionReceipt = recordCommission;

  function boot() {
  mount();

  if (window.showModule && !window.showModule.__jciWrapped) {
    const original = window.showModule;

    const wrapped = function (id) {
      if (
        id === "japanimport" ||
        id === "japanimportNav" ||
        id === "japan"
      ) {
        showPanel();
        loadOrders();
        return;
      }

      return original.apply(this, arguments);
    };

    wrapped.__jciWrapped = true;
    window.showModule = wrapped;
  }

  const button = byId("japanimportNav");

  if (button) {
    button.onclick = function (event) {
      event.preventDefault();
      showPanel();
      loadOrders();
    };
  }
}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
