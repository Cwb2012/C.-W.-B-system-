
/* =========================================================
   C.W.B SYSTEM
   CHINA & DUBAI IMPORT — CDI
   VERSION COMPLETE — NOUVELLE STRUCTURE
   ========================================================= */

(function () {
  'use strict';

  const TABLES = {
    shipments: 'cwb_cd_shipments',
    suppliers: 'cwb_cd_import_suppliers',
    items: 'cwb_cd_import_items',
    costs: 'cwb_cd_import_company_costs',
    docs: 'cwb_cd_shipment_documents'
  };

  const BUCKET = 'cwb-china-dubai-customs';

  let suppliers = [];
  let items = [];
  let costs = [];

  let currentShipment = null;
  let currentShipmentId = null;

  let initialized = false;
  let isSaving = false;

  const DEFAULT_CURRENCY = 'USD';

  const CURRENCIES = ['USD', 'RMB', 'BIF'];

  const ALLOCATION_METHODS = ['CBM'];

  function val(id) {
    const element = document.getElementById(id);
    return element ? String(element.value || '').trim() : '';
  }

  function nval(id) {
    const value = Number(val(id));
    return Number.isFinite(value) ? value : 0;
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundMoney(value) {
    return Math.round(
      (safeNumber(value) + Number.EPSILON) * 100
    ) / 100;
  }

  function roundVolume(value) {
    return Math.round(
      (safeNumber(value) + Number.EPSILON) * 1000000
    ) / 1000000;
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function showMessage(message, type = 'info') {
    alert(message);
  }

  function getCDIDatabase() {
    const db =
      window.cwbSupabaseClient ||
      window.supabaseClient ||
      window.supabase ||
      null;

    if (!db) {
      throw new Error(
        'Connexion Supabase introuvable. Vérifiez le client C.W.B.'
      );
    }

    return db;
  }

let supplierLocalCounter = 0;

function addSupplier(data = {}) {
  const supplier = {
    local_id: data.local_id || ++supplierLocalCounter,
    db_id: data.db_id || data.id || null,
    supplier_name: data.supplier_name || '',
    contact_details: data.contact_details || '',
    invoice_reference: data.invoice_reference || '',
    currency: data.currency || DEFAULT_CURRENCY,
    notes: data.notes || ''
  };

  supplierLocalCounter = Math.max(
    supplierLocalCounter,
    safeNumber(supplier.local_id)
  );

  suppliers.push(supplier);
  return supplier;
}

function addItem(data = {}) {
  const item = {
    db_id: data.db_id || data.id || null,

    supplierIndex: data.supplierIndex !== undefined
      ? String(data.supplierIndex)
      : '',

    item_name: data.item_name || '',
    category: data.category || '',
    unit: data.unit || 'pieces',

    carton_quantity: safeNumber(data.carton_quantity),
    pieces_per_carton: safeNumber(data.pieces_per_carton),
    total_quantity: safeNumber(data.total_quantity),

    cbm_entry_mode: data.cbm_entry_mode || 'per_carton',
    cbm_per_carton: safeNumber(data.cbm_per_carton),
    cbm: safeNumber(data.cbm),

    carton_length_cm: safeNumber(data.carton_length_cm),
    carton_width_cm: safeNumber(data.carton_width_cm),
    carton_height_cm: safeNumber(data.carton_height_cm),

    net_weight_per_carton_kg: safeNumber(data.net_weight_per_carton_kg),
    gross_weight_per_carton_kg: safeNumber(data.gross_weight_per_carton_kg),
    total_net_weight_kg: safeNumber(data.total_net_weight_kg),
    total_gross_weight_kg: safeNumber(data.total_gross_weight_kg),

    purchase_currency: data.purchase_currency || DEFAULT_CURRENCY,
    purchase_unit_price: safeNumber(data.purchase_unit_price),
    exchange_rate_to_bif: safeNumber(data.exchange_rate_to_bif),

    purchase_cost_usd: safeNumber(data.purchase_cost_usd),
    purchase_cost_bif: safeNumber(data.purchase_cost_bif),

    transport_cost_bif: safeNumber(data.transport_cost_bif),
    customs_cost_bif: safeNumber(data.customs_cost_bif),
    other_costs_bif: safeNumber(data.other_costs_bif),

    transport_cost_usd: safeNumber(data.transport_cost_usd),
    document_cost_usd: safeNumber(data.document_cost_usd),

    landed_cost_usd: safeNumber(data.landed_cost_usd),
    landed_cost_bif: safeNumber(data.landed_cost_bif),

    wholesale_price_bif: safeNumber(data.wholesale_price_bif),
    retail_price_bif: safeNumber(data.retail_price_bif),

    status: data.status || 'Draft',
    stock_received_at: data.stock_received_at || null,

    notes: data.notes || ''
  };

  items.push(item);
  return item;
}

function getItemSupplier(item) {
  const index = Number(item.supplierIndex);

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= suppliers.length
  ) {
    return null;
  }

  return suppliers[index];
}

function validateSuppliers() {
  if (!suppliers.length) {
    throw new Error('Ajoutez au moins un fournisseur.');
  }

  suppliers.forEach(function (supplier, index) {
    if (!String(supplier.supplier_name || '').trim()) {
      throw new Error(
        'Le nom du fournisseur ' + (index + 1) + ' est obligatoire.'
      );
    }
  });
}

function validateItems() {
  if (!items.length) {
    throw new Error('Ajoutez au moins un article.');
  }

  items.forEach(function (item, index) {
    if (!String(item.item_name || '').trim()) {
      throw new Error(
        'Le nom de l’article ' + (index + 1) + ' est obligatoire.'
      );
    }

    if (safeNumber(item.carton_quantity) <= 0) {
      throw new Error(
        'La quantité de cartons est invalide pour : ' + item.item_name
      );
    }

    if (safeNumber(item.total_quantity) <= 0) {
      throw new Error(
        'La quantité totale est invalide pour : ' + item.item_name
      );
    }

    if (!getItemSupplier(item)) {
      throw new Error(
        'Sélectionnez un fournisseur pour : ' + item.item_name
      );
    }
  });
}
function calculateCbmPerCarton(item) {
  let cbm = 0;

  if (item.cbm_entry_mode === 'dimensions') {
    const length = safeNumber(item.carton_length_cm);
    const width = safeNumber(item.carton_width_cm);
    const height = safeNumber(item.carton_height_cm);

    if (length <= 0 || width <= 0 || height <= 0) {
      throw new Error(
        'Veuillez entrer les dimensions valides du carton : longueur, largeur et hauteur.'
      );
    }

    cbm = (length * width * height) / 1000000;
  } else {
    cbm = safeNumber(item.cbm_per_carton);
  }

  if (cbm <= 0) {
    throw new Error(
      'Veuillez entrer le CBM par carton ou les dimensions du carton pour : ' +
      (item.item_name || 'un article')
    );
  }

  return roundVolume(cbm);
}

function calculateItemCbm(item) {
  const cartons = safeNumber(item.carton_quantity);

  if (cartons <= 0) {
    throw new Error('La quantité de cartons doit être supérieure à zéro.');
  }

  const cbmPerCarton = calculateCbmPerCarton(item);
  const totalCbm = roundVolume(cartons * cbmPerCarton);

  item.cbm_per_carton = cbmPerCarton;
  item.cbm = totalCbm;

  return {
    cbm_per_carton: cbmPerCarton,
    carton_quantity: cartons,
    total_cbm: totalCbm
  };
}

function calculateItemQuantities(item) {
  const cartons = safeNumber(item.carton_quantity);
  const piecesPerCarton = safeNumber(item.pieces_per_carton);

  if (cartons <= 0) {
    throw new Error(
      'Veuillez entrer le nombre de cartons pour : ' +
      (item.item_name || 'un article')
    );
  }

  if (piecesPerCarton <= 0) {
    throw new Error(
      'Veuillez entrer le nombre de pièces par carton pour : ' +
      (item.item_name || 'un article')
    );
  }

  const totalQuantity = cartons * piecesPerCarton;

  const netPerCarton = safeNumber(item.net_weight_per_carton_kg);
  const grossPerCarton = safeNumber(item.gross_weight_per_carton_kg);

  item.total_quantity = totalQuantity;
  item.total_net_weight_kg = roundVolume(cartons * netPerCarton);
  item.total_gross_weight_kg = roundVolume(cartons * grossPerCarton);

  return {
    carton_quantity: cartons,
    pieces_per_carton: piecesPerCarton,
    total_quantity: totalQuantity,
    total_net_weight_kg: item.total_net_weight_kg,
    total_gross_weight_kg: item.total_gross_weight_kg
  };
}

function calculateShipmentCbm() {
  let total = 0;

  items.forEach(function (item) {
    total += calculateItemCbm(item).total_cbm;
  });

  return roundVolume(total);
}

function calculateShipmentCartons() {
  return items.reduce(function (total, item) {
    return total + safeNumber(item.carton_quantity);
  }, 0);
}

function calculateShipmentWeight() {
  return items.reduce(function (totals, item) {
    calculateItemQuantities(item);

    totals.net += safeNumber(item.total_net_weight_kg);
    totals.gross += safeNumber(item.total_gross_weight_kg);

    return totals;
  }, { net: 0, gross: 0 });
}

function calculateShipmentVolumes() {
  const totalCbm = calculateShipmentCbm();
  const totalCartons = calculateShipmentCartons();
  const weight = calculateShipmentWeight();

  return {
    total_cartons: totalCartons,
    total_cbm: totalCbm,
    total_net_weight_kg: roundVolume(weight.net),
    total_gross_weight_kg: roundVolume(weight.gross)
  };
}

function getShipmentExchangeRates() {
  const usdToBif = nval('cdiUsdRate');
  const rmbPerUsd = nval('cdiRmbRate');

  if (usdToBif <= 0) {
    throw new Error(
      'Veuillez entrer un taux USD vers BIF valide.'
    );
  }

  if (rmbPerUsd <= 0) {
    throw new Error(
      'Veuillez entrer le nombre de RMB pour 1 USD.'
    );
  }

  return {
    usd_to_bif: usdToBif,
    rmb_to_usd: 1 / rmbPerUsd
  };
}

function convertCurrencyToUSD(amount, currency, rates) {
  const value = safeNumber(amount);

  if (value < 0) {
    throw new Error('Le montant ne peut pas être négatif.');
  }

  switch (currency) {
    case 'USD':
      return roundMoney(value);

    case 'RMB':
      return roundMoney(value * rates.rmb_to_usd);

    case 'BIF':
      return roundMoney(value / rates.usd_to_bif);

    default:
      throw new Error('Devise non reconnue : ' + currency);
  }
}

function convertUSDToBIF(amount, rates) {
  return roundMoney(
    safeNumber(amount) * rates.usd_to_bif
  );
}

function getPurchaseExchangeRate(currency, rates) {
  switch (currency) {
    case 'USD':
      return rates.usd_to_bif;

    case 'RMB':
      return rates.rmb_to_usd * rates.usd_to_bif;

    case 'BIF':
      return 1;

    default:
      throw new Error('Devise d’achat non reconnue : ' + currency);
  }
}

function calculateItemPurchase(item, rates) {
  calculateItemQuantities(item);

  const quantity = safeNumber(item.total_quantity);
  const unitPrice = safeNumber(item.purchase_unit_price);

  if (quantity <= 0) {
    throw new Error(
      'Quantité invalide pour : ' + (item.item_name || 'un article')
    );
  }

  if (unitPrice < 0) {
    throw new Error(
      'Le prix d’achat ne peut pas être négatif pour : ' +
      (item.item_name || 'un article')
    );
  }

  if (!CURRENCIES.includes(item.purchase_currency)) {
    throw new Error(
      'Devise d’achat invalide pour : ' + item.item_name
    );
  }
  const purchaseOriginal = quantity * unitPrice;

  const purchaseUSD = convertCurrencyToUSD(
    purchaseOriginal,
    item.purchase_currency,
    rates
  );

  const purchaseBIF = convertUSDToBIF(
    purchaseUSD,
    rates
  );

  item.exchange_rate_to_bif = getPurchaseExchangeRate(
    item.purchase_currency,
    rates
  );

  item.purchase_cost_usd = purchaseUSD;
  item.purchase_cost_bif = purchaseBIF;

  return {
    total_quantity: quantity,
    purchase_currency: item.purchase_currency,
    purchase_unit_price: unitPrice,
    purchase_original: roundMoney(purchaseOriginal),
    exchange_rate_to_bif: item.exchange_rate_to_bif,
    purchase_cost_usd: purchaseUSD,
    purchase_cost_bif: purchaseBIF
  };
}

function calculateShipmentPurchases() {
  const rates = getShipmentExchangeRates();

  return items.reduce(function (totals, item) {
    const result = calculateItemPurchase(item, rates);

    totals.total_usd += result.purchase_cost_usd;
    totals.total_bif += result.purchase_cost_bif;

    return totals;
  }, {
    total_usd: 0,
    total_bif: 0
  });
}

function addCost(data = {}) {
  const cost = {
    company_name: data.company_name || '',
    service_description: data.service_description || '',
    invoice_reference: data.invoice_reference || '',
    currency: data.currency || 'BIF',
    amount: safeNumber(data.amount),
    exchange_rate_to_bif: safeNumber(data.exchange_rate_to_bif),
    notes: data.notes || ''
  };

  costs.push(cost);
  return cost;
}

function calculateShipmentTransport() {
  const rates = getShipmentExchangeRates();
  const totalCbm = calculateShipmentCbm();
  const transportRate = nval('cdiTransportRate');

  if (transportRate < 0) {
    throw new Error('Le tarif de transport ne peut pas être négatif.');
  }

  const transportUSD = roundMoney(totalCbm * transportRate);

  return {
    total_cbm: totalCbm,
    rate_usd_per_cbm: transportRate,
    transport_usd: transportUSD,
    transport_bif: convertUSDToBIF(transportUSD, rates)
  };
}

function calculateDocumentFee() {
  const rates = getShipmentExchangeRates();
  const documentUSD = nval('cdiDocFee');

  if (documentUSD < 0) {
    throw new Error('Les frais de documents ne peuvent pas être négatifs.');
  }

  return {
    document_usd: roundMoney(documentUSD),
    document_bif: convertUSDToBIF(documentUSD, rates)
  };
}

function calculateCommonCosts() {
  const rates = getShipmentExchangeRates();

  return costs.reduce(function (totals, cost) {
    const amount = safeNumber(cost.amount);

    if (amount < 0) {
      throw new Error(
        'Une dépense commune ne peut pas être négative.'
      );
    }

    if (!CURRENCIES.includes(cost.currency)) {
      throw new Error(
        'Devise invalide pour la dépense : ' +
        (cost.service_description || cost.company_name)
      );
    }

    const amountUSD = convertCurrencyToUSD(
      amount,
      cost.currency,
      rates
    );

    const amountBIF = convertUSDToBIF(
      amountUSD,
      rates
    );

    cost.exchange_rate_to_bif = getPurchaseExchangeRate(
      cost.currency,
      rates
    );

    totals.other_expenses_usd += amountUSD;
    totals.other_expenses_bif += amountBIF;

    return totals;
  }, {
    other_expenses_usd: 0,
    other_expenses_bif: 0
  });
}

function calculateDirectItemCosts(item, rates) {
  const transportBIF = safeNumber(item.transport_cost_bif);
  const customsBIF = safeNumber(item.customs_cost_bif);
  const otherBIF = safeNumber(item.other_costs_bif);

  if (transportBIF < 0 || customsBIF < 0 || otherBIF < 0) {
    throw new Error(
      'Les dépenses directes ne peuvent pas être négatives pour : ' +
      (item.item_name || 'un article')
    );
  }

  const totalDirectBIF = transportBIF + customsBIF + otherBIF;

  const transportUSD = roundMoney(
    transportBIF / rates.usd_to_bif
  );

  const customsUSD = roundMoney(
    customsBIF / rates.usd_to_bif
  );

  const otherUSD = roundMoney(
    otherBIF / rates.usd_to_bif
  );

  return {
    direct_transport_bif: transportBIF,
    direct_customs_bif: customsBIF,
    direct_other_bif: otherBIF,
    total_direct_bif: roundMoney(totalDirectBIF),

    direct_transport_usd: transportUSD,
    direct_customs_usd: customsUSD,
    direct_other_usd: otherUSD,

    total_direct_usd: roundMoney(
      transportUSD + customsUSD + otherUSD
    )
  };
}

function calculateShipmentExpenses() {
  const transport = calculateShipmentTransport();
  const documents = calculateDocumentFee();
  const common = calculateCommonCosts();

  const directExpensesUSD = items.reduce(function (total, item) {
    const rates = getShipmentExchangeRates();
    const direct = calculateDirectItemCosts(item, rates);

    return total + direct.total_direct_usd;
  }, 0);

  const totalExpensesUSD =
    transport.transport_usd +
    documents.document_usd +
    common.other_expenses_usd +
    directExpensesUSD;

  const rates = getShipmentExchangeRates();

  return {
    transport: transport,
    documents: documents,
    common: common,

    direct_expenses_usd: roundMoney(directExpensesUSD),

    total_expenses_usd: roundMoney(totalExpensesUSD),
    total_expenses_bif: convertUSDToBIF(totalExpensesUSD, rates)
  };
}

function getAllocationMethod() {
  return 'CBM';
}

function getItemAllocationBase(item, method) {
  switch (method) {
    case 'CBM':
      return safeNumber(item.cbm);

    case 'CARTONS':
      return safeNumber(item.carton_quantity);

    case 'PURCHASE_VALUE':
      return safeNumber(item.purchase_cost_usd);

    default:
      return 0;
  }
}

function allocateCommonExpenses(totalExpensesUSD, method) {
  const total = roundMoney(totalExpensesUSD);

  const bases = items.map(function (item) {
    return getItemAllocationBase(item, method);
  });

  const totalBase = bases.reduce(function (sum, value) {
    return sum + value;
  }, 0);

  if (total <= 0) {
    return items.map(function () {
      return 0;
    });
  }

  if (totalBase <= 0) {
    throw new Error(
      'Impossible de répartir les frais : la base de répartition est nulle.'
    );
  }

  let allocated = 0;

  return items.map(function (item, index) {
    let share;

    if (index === items.length - 1) {
      share = roundMoney(total - allocated);
    } else {
      share = roundMoney(
        total * (bases[index] / totalBase)
      );
      allocated += share;
    }

    return share;
  });
}

function calculateItemLandedCost(
  item,
  allocatedTransportUSD,
  allocatedDocumentUSD,
  allocatedCommonUSD,
  rates
) {
  calculateItemQuantities(item);
  calculateItemCbm(item);

  const purchase = calculateItemPurchase(item, rates);
  const direct = calculateDirectItemCosts(item, rates);

  const transportAllocation = roundMoney(allocatedTransportUSD);
  const documentAllocation = roundMoney(allocatedDocumentUSD);
  const commonAllocation = roundMoney(allocatedCommonUSD);

  const totalTransportUSD = roundMoney(
    direct.direct_transport_usd + transportAllocation
  );

  const totalDocumentUSD = documentAllocation;

  const totalCustomsUSD = direct.direct_customs_usd;

  const totalOtherUSD = roundMoney(
    direct.direct_other_usd + commonAllocation
  );

  const landedUSD = roundMoney(
    purchase.purchase_cost_usd +
    totalTransportUSD +
    totalDocumentUSD +
    totalCustomsUSD +
    totalOtherUSD
  );

  const landedBIF = convertUSDToBIF(landedUSD, rates);

  item.purchase_cost_usd = purchase.purchase_cost_usd;
  item.purchase_cost_bif = purchase.purchase_cost_bif;

  item.transport_cost_usd = totalTransportUSD;
  item.document_cost_usd = totalDocumentUSD;

  item.landed_cost_usd = landedUSD;
  item.landed_cost_bif = landedBIF;

  return {
    item_name: item.item_name,

    purchase_cost_usd: purchase.purchase_cost_usd,
    purchase_cost_bif: purchase.purchase_cost_bif,

    direct_transport_usd: direct.direct_transport_usd,
    direct_customs_usd: direct.direct_customs_usd,
    direct_other_usd: direct.direct_other_usd,

    allocated_transport_usd: transportAllocation,
    allocated_document_usd: documentAllocation,
    allocated_common_usd: commonAllocation,

    total_transport_usd: totalTransportUSD,
    total_document_usd: totalDocumentUSD,
    total_customs_usd: totalCustomsUSD,
    total_other_usd: totalOtherUSD,

    landed_cost_usd: landedUSD,
    landed_cost_bif: landedBIF,

    total_quantity: safeNumber(item.total_quantity),

    unit_landed_cost_bif: item.total_quantity > 0
      ? roundMoney(landedBIF / item.total_quantity)
      : 0
  };
}

function calculateShipmentLandedCosts() {
  if (!items.length) {
    throw new Error('Aucun article à calculer.');
  }

  const rates = getShipmentExchangeRates();

  items.forEach(function (item) {
    calculateItemQuantities(item);
    calculateItemCbm(item);
    calculateItemPurchase(item, rates);
  });

  const transport = calculateShipmentTransport();
  const documents = calculateDocumentFee();
  const common = calculateCommonCosts();

  const method = getAllocationMethod();

  const transportShares = allocateCommonExpenses(
    transport.transport_usd,
    method
  );

  const documentShares = allocateCommonExpenses(
    documents.document_usd,
    method
  );

  const commonShares = allocateCommonExpenses(
    common.other_expenses_usd,
    method
  );

  const results = items.map(function (item, index) {
    return calculateItemLandedCost(
      item,
      transportShares[index],
      documentShares[index],
      commonShares[index],
      rates
    );
  });

  const totalPurchaseUSD = results.reduce(function (sum, result) {
    return sum + result.purchase_cost_usd;
  }, 0);

  const totalLandedUSD = results.reduce(function (sum, result) {
    return sum + result.landed_cost_usd;
  }, 0);

  const totalLandedBIF = convertUSDToBIF(
    totalLandedUSD,
    rates
  );

  return {
    allocation_method: method,

    total_cbm: calculateShipmentCbm(),
    total_cartons: calculateShipmentCartons(),

    total_purchase_usd: roundMoney(totalPurchaseUSD),

    total_transport_usd: transport.transport_usd,
    total_document_usd: documents.document_usd,
    total_common_expenses_usd: common.other_expenses_usd,

    total_landed_usd: roundMoney(totalLandedUSD),
    total_landed_bif: totalLandedBIF,

    items: results
  };
}

function calculateSellingResult(unitCost, sellingPrice) {
  const cost = safeNumber(unitCost);
  const price = safeNumber(sellingPrice);

  const profit = roundMoney(price - cost);

  const margin = price > 0
    ? roundMoney((profit / price) * 100)
    : 0;

  const markup = cost > 0
    ? roundMoney((profit / cost) * 100)
    : 0;

  return {
    unit_cost_bif: roundMoney(cost),
    selling_price_bif: roundMoney(price),
    profit_bif: profit,
    margin_percent: margin,
    markup_percent: markup,
    below_cost: price < cost
  };
}

function calculatePotentialProfit(unitCost, sellingPrice, quantity) {
  const result = calculateSellingResult(unitCost, sellingPrice);
  const qty = safeNumber(quantity);

  return {
    profit_per_unit_bif: result.profit_bif,
    potential_total_profit_bif: roundMoney(
      result.profit_bif * qty
    ),
    margin_percent: result.margin_percent,
    markup_percent: result.markup_percent,
    below_cost: result.below_cost
  };
}

function calculateItemSellingPrices(item, rates) {
  calculateItemQuantities(item);

  const quantity = safeNumber(item.total_quantity);
  const totalLandedCost = safeNumber(item.landed_cost_bif);

  if (quantity <= 0 || totalLandedCost <= 0) {
    throw new Error(
      'Le coût de revient doit être calculé avant les prix de vente pour : ' +
      (item.item_name || 'un article')
    );
  }

  const unitCost = totalLandedCost / quantity;

  const wholesalePrice = safeNumber(item.wholesale_price_bif);
  const retailPrice = safeNumber(item.retail_price_bif);

  const wholesale = calculatePotentialProfit(
    unitCost,
    wholesalePrice,
    quantity
  );

  const retail = calculatePotentialProfit(
    unitCost,
    retailPrice,
    quantity
  );

  return {
    item_name: item.item_name,

    unit_landed_cost_bif: roundMoney(unitCost),

    wholesale_price_bif: roundMoney(wholesalePrice),
    wholesale_profit_per_unit_bif: wholesale.profit_per_unit_bif,
    wholesale_potential_profit_bif: wholesale.potential_total_profit_bif,
    wholesale_margin_percent: wholesale.margin_percent,
    wholesale_markup_percent: wholesale.markup_percent,
    wholesale_below_cost: wholesale.below_cost,

    retail_price_bif: roundMoney(retailPrice),
    retail_profit_per_unit_bif: retail.profit_per_unit_bif,
    retail_potential_profit_bif: retail.potential_total_profit_bif,
    retail_margin_percent: retail.margin_percent,
    retail_markup_percent: retail.markup_percent,
    retail_below_cost: retail.below_cost
  };
}

function calculateShipmentSellingPrices() {
  const landed = calculateShipmentLandedCosts();
  const rates = getShipmentExchangeRates();

  const results = items.map(function (item) {
    return calculateItemSellingPrices(item, rates);
  });

  const totals = results.reduce(function (sum, result) {
    sum.wholesale_profit_bif += result.wholesale_potential_profit_bif;
    sum.retail_profit_bif += result.retail_potential_profit_bif;

    return sum;
  }, {
    wholesale_profit_bif: 0,
    retail_profit_bif: 0
  });

  return {
    landed_costs: landed,

    items: results,

    total_potential_wholesale_profit_bif: roundMoney(
      totals.wholesale_profit_bif
    ),

    total_potential_retail_profit_bif: roundMoney(
      totals.retail_profit_bif
    )
  };
}

function getCDIDatabase() {
  const db =
    window.cwbSupabaseClient ||
    window.supabaseClient ||
    (typeof supabase !== 'undefined' ? supabase : null);

  if (!db || typeof db.from !== 'function') {
    throw new Error('Connexion Supabase introuvable.');
  }

  return db;
}

async function saveShipment() {
  if (isSaving) {
    alert('Enregistrement déjà en cours.');
    return;
  }

  isSaving = true;

  try {
    const db = getCDIDatabase();

    validateSuppliers();
    validateItems();

    const rates = getShipmentExchangeRates();
    const landed = calculateShipmentLandedCosts();

    const userResult = await db.auth.getUser();

    if (userResult.error) {
      throw userResult.error;
    }

    const user = userResult.data.user;

    if (!user) {
      throw new Error('Veuillez vous connecter avant de sauvegarder.');
    }

    const shipmentPayload = {
      created_by: user.id,
      source_country: val('cdiSourceCountry') || 'China',
      shipment_date: val('cdiShipmentDate') || null,
      shipment_reference: val('cdiShipmentReference'),
      status: 'Draft',
      notes: val('cdiShipmentNotes'),
      usd_to_bif_rate: rates.usd_to_bif,
      rmb_to_usd_rate: rates.rmb_to_usd,
      transport_rate_usd_per_cbm: nval('cdiTransportRate'),
      document_fee_usd: nval('cdiDocFee')
    };

    const shipmentResult = await db
      .from(TABLES.shipments)
      .insert(shipmentPayload)
      .select()
      .single();

    if (shipmentResult.error) {
      throw shipmentResult.error;
    }

    const shipment = shipmentResult.data;
    currentShipment = shipment;
    currentShipmentId = shipment.id;

    const supplierIds = new Map();

    for (const supplier of suppliers) {
      const supplierPayload = {
        shipment_id: shipment.id,
        supplier_name: supplier.supplier_name,
        contact_details: supplier.contact_details,
        invoice_reference: supplier.invoice_reference,
        currency: supplier.currency,
        notes: supplier.notes
      };

      const supplierResult = await db
        .from(TABLES.suppliers)
        .insert(supplierPayload)
        .select()
        .single();

      if (supplierResult.error) {
        throw supplierResult.error;
      }

      supplierIds.set(supplier, supplierResult.data.id);
    }

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const result = landed.items[index];
      const supplier = getItemSupplier(item);

      if (!supplier || !supplierIds.has(supplier)) {
        throw new Error(
          'Fournisseur introuvable pour : ' + item.item_name
        );
      }

      const itemPayload = {
        shipment_id: shipment.id,
        supplier_id: supplierIds.get(supplier),

        item_name: item.item_name,
        category: item.category,
        unit: item.unit,

        carton_quantity: item.carton_quantity,
        pieces_per_carton: item.pieces_per_carton,
        total_quantity: item.total_quantity,

        purchase_currency: item.purchase_currency,
        purchase_unit_price: item.purchase_unit_price,
        exchange_rate_to_bif: item.exchange_rate_to_bif,

        purchase_cost_usd: result.purchase_cost_usd,
        purchase_cost_bif: result.purchase_cost_bif,

        cbm_entry_mode: item.cbm_entry_mode,
        cbm_per_carton: item.cbm_per_carton,
        cbm: item.cbm,

        net_weight_per_carton_kg: item.net_weight_per_carton_kg,
        gross_weight_per_carton_kg: item.gross_weight_per_carton_kg,
        total_net_weight_kg: item.total_net_weight_kg,
        total_gross_weight_kg: item.total_gross_weight_kg,

        transport_cost_bif: safeNumber(item.transport_cost_bif),
        customs_cost_bif: safeNumber(item.customs_cost_bif),
        other_costs_bif: safeNumber(item.other_costs_bif),

        transport_cost_usd: result.total_transport_usd,
        document_cost_usd: result.total_document_usd,

        landed_cost_usd: result.landed_cost_usd,
        landed_cost_bif: result.landed_cost_bif,

        wholesale_price_bif: safeNumber(item.wholesale_price_bif),
        retail_price_bif: safeNumber(item.retail_price_bif),

        status: 'Draft',
        notes: item.notes
      };

      const itemResult = await db
        .from(TABLES.items)
        .insert(itemPayload);

      if (itemResult.error) {
        throw itemResult.error;
      }
    }

    for (const cost of costs) {
      const amountUSD = convertCurrencyToUSD(
        cost.amount,
        cost.currency,
        rates
      );

      const amountBIF = convertUSDToBIF(
        amountUSD,
        rates
      );

      const costPayload = {
        shipment_id: shipment.id,
        company_name: cost.company_name,
        service_description: cost.service_description,
        invoice_reference: cost.invoice_reference,
        currency: cost.currency,
        amount: cost.amount,
        exchange_rate_to_bif: getPurchaseExchangeRate(
          cost.currency,
          rates
        ),
        amount_bif: amountBIF,
        notes: cost.notes
      };

      const costResult = await db
        .from(TABLES.costs)
        .insert(costPayload);

      if (costResult.error) {
        throw costResult.error;
      }
    }

    alert(
      'Expédition enregistrée avec succès.\n' +
      'Numéro : ' + (shipment.shipment_number || shipment.id) +
      '\nCoût total : ' +
      landed.total_landed_usd.toFixed(2) + ' USD' +
      '\nÉquivalent : ' +
      landed.total_landed_bif.toLocaleString() + ' BIF'
    );

    return shipment;

  } catch (error) {
    console.error('CDI saveShipment error:', error);

    alert(
      'Erreur pendant l’enregistrement :\n' +
      (error.message || 'Erreur inconnue') +
      '\n\nSi le dossier a déjà été créé dans Supabase, vérifiez-le avant de recommencer afin d’éviter les doublons.'
    );

    return null;

  } finally {
    isSaving = false;
  }
}

async function setArrived(itemId) {
  try {
    const db = getCDIDatabase();

    const itemResult = await db
      .from(TABLES.items)
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemResult.error) {
      throw itemResult.error;
    }

    const item = itemResult.data;

    if (item.status === 'Received' || item.stock_received_at) {
      throw new Error('Cet article a déjà été réceptionné.');
    }

    if (safeNumber(item.total_quantity) <= 0) {
      throw new Error('La quantité totale de l’article est invalide.');
    }

    if (safeNumber(item.landed_cost_bif) <= 0) {
      throw new Error('Le coût total de revient doit être calculé.');
    }

    if (
      safeNumber(item.wholesale_price_bif) <= 0 ||
      safeNumber(item.retail_price_bif) <= 0
    ) {
      throw new Error(
        'Veuillez fixer le prix de gros et le prix de détail avant de confirmer l’arrivée.'
      );
    }

    const updateResult = await db
      .from(TABLES.items)
      .update({
        status: 'Arrived',
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .eq('status', 'Draft');

    if (updateResult.error) {
      throw updateResult.error;
    }

    alert('Article marqué comme arrivé. Il peut maintenant être réceptionné dans l’Inventaire.');

    return true;

  } catch (error) {
    console.error('CDI setArrived error:', error);
    alert(error.message || 'Impossible de confirmer l’arrivée.');
    return false;
  }
}

async function receiveItem(itemId) {
  try {
    const db = getCDIDatabase();

    const result = await db.rpc(
      'cwb_cd_confirm_item_receipt',
      { p_item_id: itemId }
    );

    if (result.error) {
      throw result.error;
    }

    alert(
      'Réception confirmée !\n' +
      'L’article a été ajouté ou mis à jour dans l’Inventaire.'
    );

    return result.data;

  } catch (error) {
    console.error('CDI receiveItem error:', error);

    alert(
      'Erreur pendant la réception :\n' +
      (error.message || 'Erreur inconnue')
    );

    return null;
  }
}

async function searchShipment(shipmentNumber) {
  try {
    const db = getCDIDatabase();
    const query = String(shipmentNumber || '').trim();

    if (!query) {
      throw new Error('Entrez un numéro d’expédition à rechercher.');
    }

    const normalize = function (value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    };

    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      throw new Error('Entrez un numéro ou une référence valide.');
    }

    const result = await db
      .from(TABLES.shipments)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (result.error) throw result.error;

    return (result.data || []).filter(function (shipment) {
      const number = normalize(shipment.shipment_number);
      const reference = normalize(shipment.shipment_reference);

      return number.includes(normalizedQuery) ||
        reference.includes(normalizedQuery);
    }).slice(0, 10);

  } catch (error) {
    console.error('CDI search error:', error);
    alert(error.message || 'Erreur pendant la recherche.');
    return [];
  }
}

async function loadShipment(shipmentId) {
  try {
    const db = getCDIDatabase();

    const shipmentResult = await db
      .from(TABLES.shipments)
      .select('*')
      .eq('id', shipmentId)
      .single();

    if (shipmentResult.error) {
      throw shipmentResult.error;
    }

    const shipment = shipmentResult.data;

    const [
      supplierResult,
      itemResult,
      costResult,
      documentResult
    ] = await Promise.all([
      db.from(TABLES.suppliers)
        .select('*')
        .eq('shipment_id', shipmentId),

      db.from(TABLES.items)
        .select('*')
        .eq('shipment_id', shipmentId),

      db.from(TABLES.costs)
        .select('*')
        .eq('shipment_id', shipmentId),

      db.from(TABLES.docs)
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false })
    ]);

    if (supplierResult.error) throw supplierResult.error;
    if (itemResult.error) throw itemResult.error;
    if (costResult.error) throw costResult.error;
    if (documentResult.error) throw documentResult.error;

    currentShipment = shipment;
    currentShipmentId = shipment.id;

    suppliers = [];
    items = [];
    costs = [];

    const supplierIndexById = new Map();

    (supplierResult.data || []).forEach(function (row) {
      const supplier = addSupplier(row);
      supplier.db_id = row.id;
      supplierIndexById.set(row.id, suppliers.length - 1);
    });

    (itemResult.data || []).forEach(function (row) {
      const item = addItem({
        ...row,
        supplierIndex: supplierIndexById.has(row.supplier_id)
          ? String(supplierIndexById.get(row.supplier_id))
          : ''
      });

      item.db_id = row.id;
    });

    (costResult.data || []).forEach(function (row) {
      addCost(row);
    });
    const usdRate = document.getElementById('cdiUsdRate');
    const rmbRate = document.getElementById('cdiRmbRate');
    const transportRate = document.getElementById('cdiTransportRate');
    const documentFee = document.getElementById('cdiDocFee');

    if (usdRate) usdRate.value = shipment.usd_to_bif_rate || '';
    if (rmbRate) {
  const savedRate = Number(shipment.rmb_to_usd_rate);
  rmbRate.value = savedRate > 0
    ? (1 / savedRate).toFixed(6)
    : '';
}
    if (transportRate) {
      transportRate.value = shipment.transport_rate_usd_per_cbm || 0;
    }
    if (documentFee) {
      documentFee.value = shipment.document_fee_usd || 0;
    }
    if (typeof renderSuppliers === 'function') renderSuppliers();
    if (typeof renderItems === 'function') renderItems();
    if (typeof renderCosts === 'function') renderCosts();

    return {
      shipment: shipment,
      suppliers: supplierResult.data || [],
      items: itemResult.data || [],
      costs: costResult.data || [],
      documents: documentResult.data || []
    };

  } catch (error) {
    console.error('CDI load error:', error);
    alert(error.message || 'Impossible de charger cette expédition.');
    return null;
  }
}

async function uploadShipmentDocument(
  file,
  documentType = 'Document',
  supplierId = null
) {
  try {
    if (!currentShipmentId) {
      throw new Error('Ouvrez ou enregistrez une expédition avant d’ajouter un document.');
    }

    if (!file) {
      throw new Error('Aucun fichier sélectionné.');
    }

    const db = getCDIDatabase();

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath =
      currentShipmentId + '/' +
      Date.now() + '_' + safeName;

    const uploadResult = await db.storage
      .from(BUCKET)
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const documentPayload = {
      shipment_id: currentShipmentId,
      supplier_id: supplierId,
      company_cost_id: null,
      document_type: documentType,
      document_path: uploadResult.data.path,
      original_name: file.name,
      uploaded_by: (
        await db.auth.getUser()
      ).data.user?.id || null
    };

    const saveResult = await db
      .from(TABLES.docs)
      .insert(documentPayload)
      .select()
      .single();

    if (saveResult.error) {
      throw saveResult.error;
    }

    alert('Document archivé avec succès.');

    return saveResult.data;

  } catch (error) {
    console.error('CDI document upload error:', error);
    alert(error.message || 'Impossible d’archiver le document.');
    return null;
  }
}

async function uploadShipmentPhotos(files) {
  const uploaded = [];

  for (const file of Array.from(files || [])) {
    if (!file.type || !file.type.startsWith('image/')) {
      continue;
    }

    const result = await uploadShipmentDocument(file, 'Image');

    if (result) {
      uploaded.push(result);
    }
  }

  return uploaded;
}

async function getShipmentDocumentUrl(documentPath) {
  const db = getCDIDatabase();

  const result = await db.storage
    .from(BUCKET)
    .createSignedUrl(documentPath, 3600);

  if (result.error) {
    throw result.error;
  }

  return result.data.signedUrl;
}

async function openShipmentDocument(documentPath) {
  try {
    const url = await getShipmentDocumentUrl(documentPath);
    window.open(url, '_blank', 'noopener');

  } catch (error) {
    console.error('CDI document open error:', error);
    alert(error.message || 'Impossible d’ouvrir ce document.');
  }
}

function printShipment() {
  if (!currentShipment) {
    alert('Aucune expédition chargée à imprimer.');
    return;
  }

  try {
    const rates = getShipmentExchangeRates();
    const landed = calculateShipmentLandedCosts();

    const escape = function (value) {
      return escapeHTML(value ?? '');
    };

    const rows = landed.items.map(function (result, index) {
      const item = items[index];

      return `
        <tr>
          <td>${escape(item.item_name)}</td>
          <td>${escape(item.carton_quantity)}</td>
          <td>${escape(item.total_quantity)}</td>
          <td>${escape(item.cbm)}</td>
          <td>${escape(result.purchase_cost_usd.toFixed(2))}</td>
          <td>${escape(result.total_transport_usd.toFixed(2))}</td>
          <td>${escape(result.total_document_usd.toFixed(2))}</td>
          <td>${escape(result.landed_cost_usd.toFixed(2))}</td>
          <td>${escape(result.landed_cost_bif.toLocaleString())}</td>
        </tr>
      `;
    }).join('');

    const supplierRows = suppliers.map(function (supplier) {
      return `
        <tr>
          <td>${escape(supplier.supplier_name)}</td>
          <td>${escape(supplier.invoice_reference)}</td>
          <td>${escape(supplier.currency)}</td>
          <td>${escape(supplier.contact_details)}</td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      throw new Error('Autorisez les fenêtres pop-up pour imprimer le dossier.');
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${escape(currentShipment.shipment_number || 'CDI')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #222; }
          h1, h2 { color: #17365d; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0 25px; }
          th, td { border: 1px solid #bbb; padding: 7px; text-align: left; font-size: 11px; }
          th { background: #eee; }
          .summary { margin: 20px 0; padding: 12px; border: 1px solid #bbb; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>C.W.B SYSTEM — CHINA & DUBAI IMPORT</h1>
        <h2>Rapport d'expédition</h2>

        <p><strong>Numéro :</strong>
          ${escape(currentShipment.shipment_number)}</p>
        <p><strong>Référence :</strong>
          ${escape(currentShipment.shipment_reference)}</p>
        <p><strong>Pays :</strong>
          ${escape(currentShipment.source_country)}</p>
        <p><strong>Date :</strong>
          ${escape(currentShipment.shipment_date)}</p>
        <p><strong>Statut :</strong>
          ${escape(currentShipment.status)}</p>

        <h2>Fournisseurs et factures</h2>
        <table>
          <thead>
            <tr>
              <th>Fournisseur</th>
              <th>Référence facture</th>
              <th>Devise</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>${supplierRows}</tbody>
        </table>

        <h2>Détail des marchandises et coûts</h2>
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Cartons</th>
              <th>Quantité</th>
              <th>CBM</th>
              <th>Achat USD</th>
              <th>Transport USD</th>
              <th>Documents USD</th>
              <th>Coût total USD</th>
              <th>Coût total BIF</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="summary">
          <h2>Résumé financier</h2>
          <p>Total CBM : ${landed.total_cbm}</p>
          <p>Total cartons : ${landed.total_cartons}</p>
          <p>Total achats : ${landed.total_purchase_usd.toFixed(2)} USD</p>
          <p>Total transport : ${landed.total_transport_usd.toFixed(2)} USD</p>
          <p>Total documents : ${landed.total_document_usd.toFixed(2)} USD</p>
          <p>Autres dépenses communes : ${landed.total_common_expenses_usd.toFixed(2)} USD</p>
          <h3>Coût total : ${landed.total_landed_usd.toFixed(2)} USD</h3>
          <h3>Équivalent : ${landed.total_landed_bif.toLocaleString()} BIF</h3>
          <p>Taux USD/BIF : ${rates.usd_to_bif}</p>
<p>Taux USD/RMB : ${(1 / rates.rmb_to_usd).toFixed(6)}</p>
        </div>

        <p><strong>Notes :</strong> ${escape(currentShipment.notes)}</p>
        <button onclick="window.print()">Imprimer le rapport</button>
      </body>
      </html>
    `);

    printWindow.document.close();

  } catch (error) {
    console.error('CDI print error:', error);
    alert(error.message || 'Impossible de préparer le rapport.');
  }
}
let currentDocuments = [];
let currentSearchResults = [];

function cdiRoot() {
  let root = document.getElementById('chinaDubaiImport');

  if (!root) {
    root = document.createElement('div');
    root.id = 'chinaDubaiImport';
    document.body.appendChild(root);
  }

  return root;
}

function cdiField(label, id, value = '', type = 'text', extra = '') {
  return `
    <label class="cdi-field">
      <span>${escapeHTML(label)}</span>
      <input
        id="${escapeHTML(id)}"
        type="${escapeHTML(type)}"
        value="${escapeHTML(value)}"
        ${extra}
      >
    </label>
  `;
}

function cdiSelect(label, id, options, selected = '') {
  return `
    <label class="cdi-field">
      <span>${escapeHTML(label)}</span>
      <select id="${escapeHTML(id)}">
        ${options.map(function (option) {
          return `
            <option value="${escapeHTML(option.value)}"
              ${String(option.value) === String(selected) ? 'selected' : ''}>
              ${escapeHTML(option.label)}
            </option>
          `;
        }).join('')}
      </select>
    </label>
  `;
}

function cdiMoney(value, currency = 'BIF') {
  return safeNumber(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 2
  }) + ' ' + currency;
}

function buildUI() {
  const root = cdiRoot();

  root.innerHTML = `
    <style>
      #chinaDubaiImport {
        padding: 14px;
        color: var(--text-color, #222);
        font-family: Arial, sans-serif;
      }
      #chinaDubaiImport .cdi-section {
        border: 1px solid #bbb;
        border-radius: 10px;
        padding: 13px;
        margin: 12px 0;
        background: var(--card-background, #fff);
      }
      #chinaDubaiImport h2 {
        font-size: 19px;
        margin: 5px 0 12px;
      }
      #chinaDubaiImport h3 {
        font-size: 16px;
        margin: 8px 0;
      }
      #chinaDubaiImport .cdi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit,minmax(145px,1fr));
        gap: 10px;
      }
      #chinaDubaiImport .cdi-field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin: 6px 0;
        font-size: 13px;
      }
      #chinaDubaiImport input,
      #chinaDubaiImport select,
      #chinaDubaiImport textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 9px;
        border: 1px solid #aaa;
        border-radius: 6px;
        font-size: 14px;
        background: var(--input-background, #fff);
        color: var(--text-color, #222);
      }
      #chinaDubaiImport textarea {
        min-height: 65px;
      }
      #chinaDubaiImport button {
        padding: 10px 13px;
        margin: 5px 3px 5px 0;
        border: 0;
        border-radius: 6px;
        background: #174d82;
        color: white;
        font-weight: bold;
        cursor: pointer;
      }
      #chinaDubaiImport button.secondary {
        background: #555;
      }
      #chinaDubaiImport button.danger {
        background: #a52a2a;
      }
      #chinaDubaiImport button:disabled {
        opacity: .5;
        cursor: not-allowed;
      }
      #chinaDubaiImport .cdi-card {
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 10px;
        margin: 9px 0;
        overflow-wrap: anywhere;
      }
      #chinaDubaiImport .cdi-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit,minmax(140px,1fr));
        gap: 8px;
      }
      #chinaDubaiImport .cdi-total {
        padding: 10px;
        border: 1px solid #aaa;
        border-radius: 7px;
      }
      #chinaDubaiImport .cdi-muted {
        font-size: 12px;
        opacity: .75;
      }
      #chinaDubaiImport .cdi-warning {
        color: #b3261e;
        font-weight: bold;
      }
      #chinaDubaiImport .cdi-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      #chinaDubaiImport .cdi-table td,
      #chinaDubaiImport .cdi-table th {
        border: 1px solid #ccc;
        padding: 7px;
        text-align: left;
      }
      #chinaDubaiImport .cdi-scroll {
        overflow-x: auto;
      }
      #chinaDubaiImport [data-cdi-readonly="true"] input,
      #chinaDubaiImport [data-cdi-readonly="true"] select,
      #chinaDubaiImport [data-cdi-readonly="true"] textarea {
        background: #eee;
      }
    </style>

    <h2>🌏 C.W.B SYSTEM — CHINA & DUBAI IMPORT</h2>

    <div class="cdi-section">
      <h2>1. Dossier d'expédition</h2>
      <div class="cdi-grid">
        ${cdiSelect('Pays d’origine', 'cdiSourceCountry', [
          {value:'China',label:'China'},
          {value:'Dubai',label:'Dubai'},
          {value:'Other',label:'Other'}
        ], 'China')}
        ${cdiField('Date d’expédition', 'cdiShipmentDate', new Date().toISOString().slice(0,10), 'date')}
        ${cdiField('Référence personnelle', 'cdiShipmentReference')}
      </div>
      <label class="cdi-field">
        <span>Notes du dossier</span>
        <textarea id="cdiShipmentNotes"></textarea>
      </label>
      <div id="cdiCurrentNumber" class="cdi-muted">
        Nouveau dossier — le numéro sera généré par Supabase.
      </div>
      <button type="button" id="cdiNewShipment" class="secondary">
        + NOUVEAU DOSSIER
      </button>
    </div>

    <div class="cdi-section">
      <h2>2. Taux de change et transport</h2>
      <div class="cdi-grid">
        ${cdiField('1 USD = RMB', 'cdiRmbRate', '', 'number', 'step="any" min="0"')}
        ${cdiField('Transport USD / CBM', 'cdiTransportRate', '0', 'number', 'step="any" min="0"')}
        ${cdiField('Frais documents USD', 'cdiDocFee', '0', 'number', 'step="any" min="0"')}
        ${cdiSelect('Répartition des frais communs', 'cdiAllocationMethod', [
  {value:'CBM',label:'Selon CBM uniquement'}
], 'CBM')}
      </div>
      <p class="cdi-muted">
        Le taux RMB est exprimé en USD pour 1 RMB.
        Le transport est calculé selon le CBM total.
      </p>
    </div>

    <div class="cdi-section">
      <h2>3. Fournisseurs et factures fournisseurs</h2>
      <div id="cdiSuppliersList"></div>
      <button type="button" id="cdiAddSupplier">+ AJOUTER UN FOURNISSEUR</button>
    </div>

    <div class="cdi-section">
      <h2>4. Marchandises</h2>
      <div id="cdiItemsList"></div>
      <button type="button" id="cdiAddItem">+ AJOUTER UNE MARCHANDISE</button>
    </div>

    <div class="cdi-section">
      <h2>5. Dépenses communes</h2>
      <div id="cdiCostsList"></div>
      <button type="button" id="cdiAddCost">+ AJOUTER UNE DÉPENSE</button>
    </div>

    <div class="cdi-section">
      <h2>6. Résumé des calculs</h2>
      <button type="button" id="cdiCalculate">CALCULER LES COÛTS</button>
      <div id="cdiCalculationResult">
        Les résultats apparaîtront ici après le calcul.
      </div>
    </div>

    <div class="cdi-section">
      <h2>7. Enregistrement du dossier</h2>
      <button type="button" id="cdiSaveShipment">
        ENREGISTRER L’EXPÉDITION
      </button>
      <button type="button" id="cdiPrintShipment" class="secondary">
        IMPRIMER LE RAPPORT
      </button>
      <p class="cdi-muted">
        Un dossier déjà enregistré ne doit pas être enregistré une deuxième fois.
        Pour consulter un dossier existant, utilisez la recherche ci-dessous.
      </p>
    </div>

    <div class="cdi-section">
      <h2>8. Recherche d’expédition</h2>
      <div class="cdi-grid">
        <input id="cdiSearchNumber" placeholder="Numéro d’expédition">
        <button type="button" id="cdiSearchButton">RECHERCHER</button>
      </div>
      <div id="cdiSearchResults"></div>
    </div>

    <div class="cdi-section">
      <h2>9. Documents et photos</h2>
      <p class="cdi-muted">
        Enregistrez d’abord le dossier. Vous pourrez ensuite archiver
        les factures fournisseurs, documents douaniers et photos.
      </p>
      <label class="cdi-field">
        <span>Type de document</span>
        <select id="cdiDocumentType">
          <option value="Supplier invoice">Facture fournisseur</option>
          <option value="Customs document">Document douanier</option>
          <option value="Transport document">Document de transport</option>
          <option value="Payment receipt">Preuve de paiement</option>
          <option value="Other">Autre document</option>
        </select>
      </label>
      <label class="cdi-field">
        <span>Fournisseur concerné (facultatif)</span>
        <select id="cdiDocumentSupplier">
          <option value="">Document général du dossier</option>
        </select>
      </label>
      <label class="cdi-field">
        <span>Choisir un document</span>
        <input type="file" id="cdiDocumentFile">
      </label>
      <button type="button" id="cdiUploadDocument">
        ARCHIVER LE DOCUMENT
      </button>
      <label class="cdi-field">
        <span>Ajouter des photos</span>
        <input type="file" id="cdiPhotoFiles" accept="image/*" multiple>
      </label>
      <button type="button" id="cdiUploadPhotos">
        ARCHIVER LES PHOTOS
      </button>
      <div id="cdiDocumentsList"></div>
    </div>

    <div class="cdi-section">
      <h2>10. Arrivée et réception dans l’Inventaire</h2>
      <p class="cdi-muted">
        Confirmez l’arrivée d’un article, puis réceptionnez-le dans
        l’Inventaire. Le prix de gros et le prix de détail restent ceux
        que vous avez définis.
      </p>
      <div id="cdiReceiptList"></div>
    </div>
  `;

  renderSuppliers();
  renderItems();
  renderCosts();
  renderDocumentSupplierOptions();
  renderDocuments();
  renderReceiptList();
}

function renderSuppliers() {
  const container = document.getElementById('cdiSuppliersList');
  if (!container) return;

  const readOnly = Boolean(currentShipmentId);

  container.innerHTML = suppliers.map(function (supplier, index) {
    return `
      <div class="cdi-card" data-cdi-readonly="${readOnly}">
        <h3>Fournisseur ${index + 1}</h3>
        ${cdiField('Nom du fournisseur', 'cdiSupplierName' + index, supplier.supplier_name, 'text', `data-cdi-list="suppliers" data-cdi-index="${index}" data-cdi-field="supplier_name" ${readOnly ? 'disabled' : ''}`)}
        ${cdiField('Contact / adresse', 'cdiSupplierContact' + index, supplier.contact_details, 'text', `data-cdi-list="suppliers" data-cdi-index="${index}" data-cdi-field="contact_details" ${readOnly ? 'disabled' : ''}`)}
        ${cdiField('Référence facture fournisseur', 'cdiSupplierInvoice' + index, supplier.invoice_reference, 'text', `data-cdi-list="suppliers" data-cdi-index="${index}" data-cdi-field="invoice_reference" ${readOnly ? 'disabled' : ''}`)}
        ${cdiSelect('Devise facture', 'cdiSupplierCurrency' + index, CURRENCIES.map(v => ({value:v,label:v})), supplier.currency)}
        <label class="cdi-field">
          <span>Notes</span>
          <textarea data-cdi-list="suppliers" data-cdi-index="${index}" data-cdi-field="notes" ${readOnly ? 'disabled' : ''}>${escapeHTML(supplier.notes)}</textarea>
        </label>
        ${!readOnly ? `<button type="button" class="danger" data-cdi-remove-supplier="${index}">SUPPRIMER</button>` : ''}
      </div>
    `;
  }).join('');

  renderDocumentSupplierOptions();
}

function renderItems() {
  const container = document.getElementById('cdiItemsList');
  if (!container) return;

  const readOnly = Boolean(currentShipmentId);

  container.innerHTML = items.map(function (item, index) {
    const supplierOptions = [
      {value:'',label:'Choisir le fournisseur'},
      ...suppliers.map((supplier, supplierIndex) => ({
        value:String(supplierIndex),
        label:supplier.supplier_name || ('Fournisseur ' + (supplierIndex + 1))
      }))
    ];

    return `
      <div class="cdi-card" data-cdi-readonly="${readOnly}">
        <h3>Marchandise ${index + 1}</h3>
        ${cdiSelect('Fournisseur de cette marchandise', 'cdiItemSupplier' + index, supplierOptions, item.supplierIndex)}
        ${cdiField('Nom de la marchandise', 'cdiItemName' + index, item.item_name, 'text', `data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="item_name" ${readOnly ? 'disabled' : ''}`)}
        ${cdiField('Catégorie', 'cdiItemCategory' + index, item.category, 'text', `data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="category" ${readOnly ? 'disabled' : ''}`)}
        ${cdiField('Unité', 'cdiItemUnit' + index, item.unit, 'text', `data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="unit" ${readOnly ? 'disabled' : ''}`)}

        <div class="cdi-grid">
          ${cdiField('Nombre de cartons', 'cdiCartons' + index, item.carton_quantity, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="carton_quantity" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Pièces par carton', 'cdiPieces' + index, item.pieces_per_carton, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="pieces_per_carton" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Prix d’achat par pièce/unité', 'cdiPurchasePrice' + index, item.purchase_unit_price, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="purchase_unit_price" ${readOnly ? 'disabled' : ''}`)}
          ${cdiSelect('Devise d’achat', 'cdiPurchaseCurrency' + index, CURRENCIES.map(v => ({value:v,label:v})), item.purchase_currency)}
        </div>

        <h3>Volume du carton</h3>
        ${cdiSelect('Mode de saisie CBM', 'cdiCbmMode' + index, [
          {value:'per_carton',label:'CBM par carton'},
          {value:'dimensions',label:'Dimensions en cm'}
        ], item.cbm_entry_mode)}
        <div class="cdi-grid">
          ${cdiField('CBM par carton', 'cdiCbm' + index, item.cbm_per_carton, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="cbm_per_carton" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Longueur cm', 'cdiLength' + index, item.carton_length_cm, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="carton_length_cm" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Largeur cm', 'cdiWidth' + index, item.carton_width_cm, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="carton_width_cm" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Hauteur cm', 'cdiHeight' + index, item.carton_height_cm, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="carton_height_cm" ${readOnly ? 'disabled' : ''}`)}
        </div>

        <h3>Poids par carton (kg)</h3>
        <div class="cdi-grid">
          ${cdiField('Poids net', 'cdiNetWeight' + index, item.net_weight_per_carton_kg, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="net_weight_per_carton_kg" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Poids brut', 'cdiGrossWeight' + index, item.gross_weight_per_carton_kg, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="gross_weight_per_carton_kg" ${readOnly ? 'disabled' : ''}`)}
        </div>

        <h3>Frais directs par marchandise (BIF)</h3>
        <div class="cdi-grid">
          ${cdiField('Transport direct', 'cdiDirectTransport' + index, item.transport_cost_bif, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="transport_cost_bif" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Douane / taxes', 'cdiDirectCustoms' + index, item.customs_cost_bif, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="customs_cost_bif" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Autres frais directs', 'cdiDirectOther' + index, item.other_costs_bif, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="other_costs_bif" ${readOnly ? 'disabled' : ''}`)}
        </div>

        <h3>Prix de vente définis par C.W.B (BIF)</h3>
        <div class="cdi-grid">
          ${cdiField('Prix de gros par unité', 'cdiWholesale' + index, item.wholesale_price_bif, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="wholesale_price_bif" ${readOnly ? 'disabled' : ''}`)}
          ${cdiField('Prix de détail par unité', 'cdiRetail' + index, item.retail_price_bif, 'number', `min="0" step="any" data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="retail_price_bif" ${readOnly ? 'disabled' : ''}`)}
        </div>

        <label class="cdi-field">
          <span>Notes sur la marchandise</span>
          <textarea data-cdi-list="items" data-cdi-index="${index}" data-cdi-field="notes" ${readOnly ? 'disabled' : ''}>${escapeHTML(item.notes)}</textarea>
        </label>

        ${!readOnly ? `<button type="button" class="danger" data-cdi-remove-item="${index}">SUPPRIMER CET ARTICLE</button>` : ''}
      </div>
    `;
  }).join('');

  renderReceiptList();
}

function renderCosts() {
  const container = document.getElementById('cdiCostsList');
  if (!container) return;

  const readOnly = Boolean(currentShipmentId);

  container.innerHTML = costs.map(function (cost, index) {
    return `
      <div class="cdi-card">
        <h3>Dépense ${index + 1}</h3>
        ${cdiField('Entreprise / bénéficiaire', 'cdiCostCompany' + index, cost.company_name, 'text', `data-cdi-list="costs" data-cdi-index="${index}" data-cdi-field="company_name" ${readOnly ? 'disabled' : ''}`)}
        ${cdiField('Description du service', 'cdiCostDescription' + index, cost.service_description, 'text', `data-cdi-list="costs" data-cdi-index="${index}" data-cdi-field="service_description" ${readOnly ? 'disabled' : ''}`)}
        ${cdiField('Référence facture', 'cdiCostReference' + index, cost.invoice_reference, 'text', `data-cdi-list="costs" data-cdi-index="${index}" data-cdi-field="invoice_reference" ${readOnly ? 'disabled' : ''}`)}
        <div class="cdi-grid">
          ${cdiSelect('Devise', 'cdiCostCurrency' + index, CURRENCIES.map(v => ({value:v,label:v})), cost.currency)}
          ${cdiField('Montant', 'cdiCostAmount' + index, cost.amount, 'number', `min="0" step="any" data-cdi-list="costs" data-cdi-index="${index}" data-cdi-field="amount" ${readOnly ? 'disabled' : ''}`)}
        </div>
        <label class="cdi-field">
          <span>Notes</span>
          <textarea data-cdi-list="costs" data-cdi-index="${index}" data-cdi-field="notes" ${readOnly ? 'disabled' : ''}>${escapeHTML(cost.notes)}</textarea>
        </label>
        ${!readOnly ? `<button type="button" class="danger" data-cdi-remove-cost="${index}">SUPPRIMER</button>` : ''}
      </div>
    `;
  }).join('');
}

function renderDocumentSupplierOptions() {
  const select = document.getElementById('cdiDocumentSupplier');
  if (!select) return;

  const previous = select.value;

  select.innerHTML = `
    <option value="">Document général du dossier</option>
    ${suppliers.map(function (supplier) {
      return supplier.db_id
        ? `<option value="${escapeHTML(supplier.db_id)}">${escapeHTML(supplier.supplier_name)}</option>`
        : '';
    }).join('')}
  `;

  select.value = previous;
}

function renderDocuments() {
  const container = document.getElementById('cdiDocumentsList');
  if (!container) return;

  container.innerHTML = currentDocuments.length
    ? currentDocuments.map(function (doc) {
        return `
          <div class="cdi-card">
            <strong>${escapeHTML(doc.original_name || doc.document_type)}</strong>
            <p>${escapeHTML(doc.document_type || 'Document')}</p>
            <button type="button" data-cdi-open-document="${escapeHTML(doc.document_path)}">
              OUVRIR
            </button>
          </div>
        `;
      }).join('')
    : '<p class="cdi-muted">Aucun document archivé dans ce dossier.</p>';
}

function renderReceiptList() {
  const container = document.getElementById('cdiReceiptList');
  if (!container) return;

  container.innerHTML = items.map(function (item, index) {
    const status = item.status || 'Nouveau';

    return `
      <div class="cdi-card">
        <strong>${escapeHTML(item.item_name || ('Article ' + (index + 1)))}</strong>
        <p>Quantité : ${escapeHTML(item.total_quantity || 0)}</p>
        <p>Statut : ${escapeHTML(status)}</p>
        <p>Coût total : ${cdiMoney(item.landed_cost_bif)}</p>
        ${
          item.db_id && status === 'Draft'
            ? `<button type="button" data-cdi-arrived="${escapeHTML(item.db_id)}">CONFIRMER L’ARRIVÉE</button>`
            : ''
        }
        ${
          item.db_id && status === 'Arrived'
            ? `<button type="button" data-cdi-receive="${escapeHTML(item.db_id)}">RÉCEPTIONNER DANS L’INVENTAIRE</button>`
            : ''
        }
        ${
          status === 'Received'
            ? '<strong>Article déjà réceptionné</strong>'
            : ''
        }
      </div>
    `;
  }).join('');
}

function renderCalculation() {
  const container = document.getElementById('cdiCalculationResult');
  if (!container) return;

  try {
    const result = calculateShipmentSellingPrices();
    const landed = result.landed_costs;

    const rows = result.items.map(function (selling, index) {
      const item = items[index];
      const cost = selling.unit_landed_cost_bif;

      return `
        <tr>
          <td>${escapeHTML(item.item_name)}</td>
          <td>${escapeHTML(item.carton_quantity)}</td>
          <td>${escapeHTML(item.total_quantity)}</td>
          <td>${escapeHTML(item.cbm)}</td>
          <td>${cdiMoney(cost)}</td>
          <td>${cdiMoney(item.wholesale_price_bif)}</td>
          <td>${cdiMoney(selling.wholesale_potential_profit_bif)}</td>
          <td>${cdiMoney(item.retail_price_bif)}</td>
          <td>${cdiMoney(selling.retail_potential_profit_bif)}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="cdi-summary">
        <div class="cdi-total"><strong>CBM total</strong><br>${landed.total_cbm}</div>
        <div class="cdi-total"><strong>Cartons</strong><br>${landed.total_cartons}</div>
        <div class="cdi-total"><strong>Achats</strong><br>${cdiMoney(landed.total_purchase_usd, 'USD')}</div>
        <div class="cdi-total"><strong>Transport</strong><br>${cdiMoney(landed.total_transport_usd, 'USD')}</div>
        <div class="cdi-total"><strong>Documents</strong><br>${cdiMoney(landed.total_document_usd, 'USD')}</div>
        <div class="cdi-total"><strong>Autres frais communs</strong><br>${cdiMoney(landed.total_common_expenses_usd, 'USD')}</div>
        <div class="cdi-total"><strong>Coût total USD</strong><br>${cdiMoney(landed.total_landed_usd, 'USD')}</div>
        <div class="cdi-total"><strong>Coût total BIF</strong><br>${cdiMoney(landed.total_landed_bif)}</div>
      </div>

      <h3>Coût de revient et bénéfices potentiels</h3>
      <div class="cdi-scroll">
        <table class="cdi-table">
          <thead>
            <tr>
              <th>Marchandise</th>
              <th>Cartons</th>
              <th>Quantité</th>
              <th>CBM</th>
              <th>Coût/unité BIF</th>
              <th>Prix gros</th>
              <th>Bénéfice gros total</th>
              <th>Prix détail</th>
              <th>Bénéfice détail total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <h3>Bénéfice potentiel si toute la quantité est vendue</h3>
      <p>Au prix de gros : <strong>${cdiMoney(result.total_potential_wholesale_profit_bif)}</strong></p>
      <p>Au prix de détail : <strong>${cdiMoney(result.total_potential_retail_profit_bif)}</strong></p>
      <p class="cdi-muted">
        Ces montants sont des estimations. Le bénéfice réel dépendra des ventes effectivement réalisées.
      </p>
    `;

  } catch (error) {
    container.innerHTML = `
      <p class="cdi-warning">${escapeHTML(error.message)}</p>
    `;
  }
}

async function cdiSearchAndRender() {
  const query = val('cdiSearchNumber');
  const results = await searchShipment(query);

  currentSearchResults = results;

  const container = document.getElementById('cdiSearchResults');
  if (!container) return;

  container.innerHTML = results.length
    ? results.map(function (shipment) {
        return `
          <div class="cdi-card">
            <strong>${escapeHTML(shipment.shipment_number || shipment.id)}</strong>
            <p>${escapeHTML(shipment.source_country || '')}
              — ${escapeHTML(shipment.shipment_date || '')}</p>
            <p>Statut : ${escapeHTML(shipment.status || '')}</p>
            <button type="button" data-cdi-load="${escapeHTML(shipment.id)}">
              OUVRIR CE DOSSIER
            </button>
          </div>
        `;
      }).join('')
    : '<p>Aucun dossier trouvé.</p>';
}

async function cdiSaveNewShipment() {
  if (currentShipmentId) {
    alert('Ce dossier est déjà enregistré. Il ne faut pas le sauvegarder une deuxième fois.');
    return;
  }

  const shipment = await saveShipment();

  if (shipment && shipment.id) {
    await loadShipment(shipment.id);
    currentDocuments = [];
    renderDocuments();
    renderSuppliers();
    renderItems();
    renderCosts();
    renderReceiptList();

    const number = document.getElementById('cdiCurrentNumber');
    if (number) {
      number.textContent = 'Dossier enregistré : ' +
        (shipment.shipment_number || shipment.id);
    }

    const button = document.getElementById('cdiSaveShipment');
    if (button) {
      button.disabled = true;
      button.textContent = 'DOSSIER DÉJÀ ENREGISTRÉ';
    }
  }
}

function cdiNewShipment() {
  if (currentShipmentId) {
    if (!confirm('Créer un nouveau dossier ? Le dossier actuel restera enregistré dans Supabase.')) {
      return;
    }
  }

  suppliers = [];
  items = [];
  costs = [];
  currentDocuments = [];
  currentShipment = null;
  currentShipmentId = null;

  addSupplier();
  addItem();

  buildUI();

  const saveButton = document.getElementById('cdiSaveShipment');
  if (saveButton) saveButton.disabled = false;

  const number = document.getElementById('cdiCurrentNumber');
  if (number) {
    number.textContent = 'Nouveau dossier — numéro généré par Supabase.';
  }
}

function attachCDIEvents() {
  const root = cdiRoot();

  if (root.dataset.cdiEventsAttached === 'true') return;
  root.dataset.cdiEventsAttached = 'true';

  root.addEventListener('input', function (event) {
    const element = event.target;
    const list = element.dataset.cdiList;
    if (!list) return;

    const index = Number(element.dataset.cdiIndex);
    const field = element.dataset.cdiField;

    if (!Array.isArray(window.__cdiNoop) && [suppliers, items, costs].length) {
      const target = list === 'suppliers'
        ? suppliers
        : list === 'items'
          ? items
          : list === 'costs'
            ? costs
            : null;

      if (target && target[index]) {
        const numericFields = [
          'carton_quantity','pieces_per_carton','cbm_per_carton',
          'carton_length_cm','carton_width_cm','carton_height_cm',
          'net_weight_per_carton_kg','gross_weight_per_carton_kg',
          'purchase_unit_price','transport_cost_bif','customs_cost_bif',
          'other_costs_bif','wholesale_price_bif','retail_price_bif','amount'
        ];

        target[index][field] = numericFields.includes(field)
          ? safeNumber(element.value)
          : element.value;
      }
    }
  });

  root.addEventListener('change', async function (event) {
    const element = event.target;

    if (element.dataset.cdiList) {
      const list = element.dataset.cdiList;
      const index = Number(element.dataset.cdiIndex);
      const field = element.dataset.cdiField;
      const target = list === 'suppliers'
        ? suppliers
        : list === 'items'
          ? items
          : costs;

      if (target[index]) {
        target[index][field] = element.value;
      }
    }

    if (element.id.startsWith('cdiItemSupplier')) {
      const index = Number(element.id.replace('cdiItemSupplier', ''));
      if (items[index]) items[index].supplierIndex = element.value;
    }

    if (element.id.startsWith('cdiCbmMode')) {
      const index = Number(element.id.replace('cdiCbmMode', ''));
      if (items[index]) items[index].cbm_entry_mode = element.value;
    }

    if (element.id.startsWith('cdiPurchaseCurrency')) {
      const index = Number(element.id.replace('cdiPurchaseCurrency', ''));
      if (items[index]) items[index].purchase_currency = element.value;
    }

    if (element.id.startsWith('cdiSupplierCurrency')) {
      const index = Number(element.id.replace('cdiSupplierCurrency', ''));
      if (suppliers[index]) suppliers[index].currency = element.value;
    }

    if (element.id.startsWith('cdiCostCurrency')) {
      const index = Number(element.id.replace('cdiCostCurrency', ''));
      if (costs[index]) costs[index].currency = element.value;
    }
  });

  root.addEventListener('click', async function (event) {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.id === 'cdiAddSupplier') {
      if (currentShipmentId) return;
      addSupplier();
      renderSuppliers();
      renderItems();
      return;
    }

    if (button.id === 'cdiAddItem') {
      if (currentShipmentId) return;
      addItem({supplierIndex: suppliers.length ? '0' : ''});
      renderItems();
      return;
    }

    if (button.id === 'cdiAddCost') {
      if (currentShipmentId) return;
      addCost();
      renderCosts();
      return;
    }

    if (button.id === 'cdiCalculate') {
      renderCalculation();
      return;
    }

    if (button.id === 'cdiSaveShipment') {
      await cdiSaveNewShipment();
      return;
    }

    if (button.id === 'cdiPrintShipment') {
      printShipment();
      return;
    }

    if (button.id === 'cdiSearchButton') {
      await cdiSearchAndRender();
      return;
    }

    if (button.id === 'cdiNewShipment') {
      cdiNewShipment();
      return;
    }

    if (button.id === 'cdiUploadDocument') {
      const fileInput = document.getElementById('cdiDocumentFile');
      const file = fileInput && fileInput.files[0];
      const supplierId = val('cdiDocumentSupplier') || null;

      if (!file) {
        alert('Choisissez d’abord un document.');
        return;
      }

      const uploaded = await uploadShipmentDocument(
        file,
        val('cdiDocumentType') || 'Document',
        supplierId
      );

      if (uploaded) {
        currentDocuments.unshift(uploaded);
        renderDocuments();
        fileInput.value = '';
      }
      return;
    }

    if (button.id === 'cdiUploadPhotos') {
      const input = document.getElementById('cdiPhotoFiles');
      if (!input || !input.files.length) {
        alert('Choisissez d’abord des photos.');
        return;
      }

      const uploaded = await uploadShipmentPhotos(input.files);
      currentDocuments.unshift(...uploaded);
      renderDocuments();
      input.value = '';
      return;
    }

    if (button.dataset.cdiRemoveSupplier !== undefined) {
      const index = Number(button.dataset.cdiRemoveSupplier);
      suppliers.splice(index, 1);

      items.forEach(function (item) {
        if (Number(item.supplierIndex) === index) item.supplierIndex = '';
        else if (Number(item.supplierIndex) > index) {
          item.supplierIndex = String(Number(item.supplierIndex) - 1);
        }
      });

      renderSuppliers();
      renderItems();
      return;
    }

    if (button.dataset.cdiRemoveItem !== undefined) {
      items.splice(Number(button.dataset.cdiRemoveItem), 1);
      renderItems();
      return;
    }

    if (button.dataset.cdiRemoveCost !== undefined) {
      costs.splice(Number(button.dataset.cdiRemoveCost), 1);
      renderCosts();
      return;
    }

    if (button.dataset.cdiLoad) {
      const data = await loadShipment(button.dataset.cdiLoad);
      if (data) {
        currentDocuments = data.documents || [];
        buildUI();

        document.getElementById('cdiSourceCountry').value =
          currentShipment.source_country || 'China';
        document.getElementById('cdiShipmentDate').value =
          currentShipment.shipment_date || '';
        document.getElementById('cdiShipmentReference').value =
          currentShipment.shipment_reference || '';
        document.getElementById('cdiShipmentNotes').value =
          currentShipment.notes || '';

        const number = document.getElementById('cdiCurrentNumber');
        if (number) {
          number.textContent = 'Dossier chargé : ' +
            (currentShipment.shipment_number || currentShipment.id);
        }

        document.getElementById('cdiSaveShipment').disabled = true;
        document.getElementById('cdiSaveShipment').textContent =
          'DOSSIER EXISTANT — NON MODIFIABLE';

        renderSuppliers();
        renderItems();
        renderCosts();
        renderDocuments();
        renderReceiptList();
      }
      return;
    }

    if (button.dataset.cdiOpenDocument) {
      await openShipmentDocument(button.dataset.cdiOpenDocument);
      return;
    }

    if (button.dataset.cdiArrived) {
      const success = await setArrived(button.dataset.cdiArrived);
      if (success && currentShipmentId) {
        await loadShipment(currentShipmentId);
        renderReceiptList();
      }
      return;
    }

    if (button.dataset.cdiReceive) {
      const result = await receiveItem(button.dataset.cdiReceive);
      if (result && currentShipmentId) {
        await loadShipment(currentShipmentId);
        renderReceiptList();
      }
    }
  });
}
function buildCDIInterface() {
  let root = document.getElementById('chinaDubaiImport');

  if (!root) {
    const container = document.querySelector('.container');

    if (!container) {
      console.error('CDI : conteneur principal introuvable.');
      return null;
    }

    root = document.createElement('div');
    root.id = 'chinaDubaiImport';
    root.className = 'card hidden';
    container.appendChild(root);
  }

  root.innerHTML = `
    <h2>🌏 C.W.B — CHINA & DUBAI IMPORT</h2>

    <section style="border:1px solid #999;padding:12px;margin-bottom:15px;border-radius:8px">
      <h3>🔎 Rechercher une expédition</h3>
      <input id="cdiSearchNumber" placeholder="Numéro d'expédition">
      <button type="button" data-action="search">RECHERCHER</button>
      <div id="cdiSearchResults"></div>
    </section>

    <div id="cdiEditor">

      <h3>1. Informations de l'expédition</h3>

      <label>Pays d'origine</label>
      <select id="cdiSourceCountry">
        <option value="China">China</option>
        <option value="Dubai">Dubai</option>
        <option value="China & Dubai">China & Dubai</option>
      </select>

      <label>Date d'expédition</label>
      <input type="date" id="cdiShipmentDate">

      <label>Référence personnelle</label>
      <input id="cdiShipmentReference" placeholder="Référence">

      <label>Notes</label>
      <textarea id="cdiShipmentNotes" rows="2"></textarea>

      <h3>2. Taux et transport</h3>

      <label>Taux USD vers BIF</label>
      <input type="number" id="cdiUsdRate" min="0" step="any" placeholder="Exemple : 2900">

      <label>1 USD = RMB</label>
<input type="number" id="cdiRmbRate" min="0" step="any" placeholder="Saisir le taux actuel">🏢 

      <label>Transport USD par CBM</label>
      <input type="number" id="cdiTransportRate" min="0" step="any" value="0">

      <label>Frais de documents USD</label>
      <input type="number" id="cdiDocFee" min="0" step="any" value="0">

      <label>Répartition des frais</label>
<select id="cdiAllocationMethod">
  <option value="CBM">Selon CBM uniquement</option>
</select>

      <hr>
      <h3>3. Fournisseurs et factures fournisseurs</h3>

      <div id="cdiSuppliersList"></div>

      <h4>Ajouter un fournisseur</h4>
      <input id="cdiSupplierName" placeholder="Nom du fournisseur">
      <input id="cdiSupplierContact" placeholder="Téléphone / contact">
      <input id="cdiSupplierInvoice" placeholder="Référence de sa facture">
      <select id="cdiSupplierCurrency">
        <option value="USD">USD</option>
        <option value="RMB">RMB</option>
        <option value="BIF">BIF</option>
      </select>
      <textarea id="cdiSupplierNotes" placeholder="Notes fournisseur"></textarea>
      <button type="button" data-action="add-supplier" data-edit>AJOUTER FOURNISSEUR</button>

      <hr>
      <h3>4. Marchandises importées</h3>

      <div id="cdiItemsList"></div>

      <h4>Ajouter un article</h4>

      <label>Fournisseur</label>
      <select id="cdiItemSupplier"></select>

      <input id="cdiItemName" placeholder="Nom de la marchandise">
      <input id="cdiItemCategory" placeholder="Catégorie">
      <input id="cdiItemUnit" placeholder="Unité" value="pieces">

      <label>Nombre de cartons</label>
      <input type="number" id="cdiItemCartons" min="1" step="1">

      <label>Pièces par carton</label>
      <input type="number" id="cdiItemPieces" min="1" step="1">

      <label>Mode de calcul du CBM</label>
      <select id="cdiItemCbmMode">
        <option value="per_carton">CBM par carton</option>
        <option value="dimensions">Dimensions du carton en cm</option>
      </select>

      <div id="cdiCbmPerCartonField">
        <label>CBM pour un carton</label>
        <input type="number" id="cdiItemCbmPerCarton" min="0" step="any">
      </div>

      <div id="cdiCbmDimensionsField" hidden>
        <label>Longueur du carton (cm)</label>
        <input type="number" id="cdiItemLength" min="0" step="any">
        <label>Largeur du carton (cm)</label>
        <input type="number" id="cdiItemWidth" min="0" step="any">
        <label>Hauteur du carton (cm)</label>
        <input type="number" id="cdiItemHeight" min="0" step="any">
      </div>

      <label>Poids net par carton (kg)</label>
      <input type="number" id="cdiItemNetWeight" min="0" step="any">

      <label>Poids brut par carton (kg)</label>
      <input type="number" id="cdiItemGrossWeight" min="0" step="any">

      <label>Devise d'achat</label>
      <select id="cdiItemCurrency">
        <option value="USD">USD</option>
        <option value="RMB">RMB</option>
        <option value="BIF">BIF</option>
      </select>

      <label>Prix d'achat par pièce</label>
      <input type="number" id="cdiItemPurchasePrice" min="0" step="any">

      <h4>Frais directs de cet article (BIF)</h4>
      <input type="number" id="cdiItemTransport" min="0" step="any" placeholder="Transport direct BIF">
      <input type="number" id="cdiItemCustoms" min="0" step="any" placeholder="Douane directe BIF">
      <input type="number" id="cdiItemOther" min="0" step="any" placeholder="Autres frais directs BIF">

      <h4>Prix de vente définis par C.W.B (BIF)</h4>
      <input type="number" id="cdiItemWholesale" min="0" step="any" placeholder="Prix de gros par pièce">
      <input type="number" id="cdiItemRetail" min="0" step="any" placeholder="Prix de détail par pièce">

      <textarea id="cdiItemNotes" placeholder="Notes sur cet article"></textarea>

      <button type="button" data-action="add-item" data-edit>AJOUTER ARTICLE</button>

      <hr>
      <h3>5. Dépenses communes de l'expédition</h3>

      <div id="cdiCostsList"></div>

      <h4>Ajouter une dépense</h4>
      <input id="cdiCostCompany" placeholder="Société / prestataire">
      <input id="cdiCostDescription" placeholder="Description du service">
      <input id="cdiCostInvoice" placeholder="Référence facture">
      <select id="cdiCostCurrency">
        <option value="BIF">BIF</option>
        <option value="USD">USD</option>
        <option value="RMB">RMB</option>
      </select>
      <input type="number" id="cdiCostAmount" min="0" step="any" placeholder="Montant">
      <textarea id="cdiCostNotes" placeholder="Notes"></textarea>
      <button type="button" data-action="add-cost" data-edit>AJOUTER DÉPENSE</button>

      <hr>
      <button type="button" data-action="calculate">CALCULER LES COÛTS</button>
      <div id="cdiCalculationResult"></div>

      <hr>
      <button type="button" data-action="save" data-edit>💾 ENREGISTRER L'EXPÉDITION</button>
    </div>

    <hr>
    <h3>6. Documents et photos</h3>
    <p>Les documents peuvent être ajoutés après l'enregistrement de l'expédition.</p>

    <label>Archiver une facture fournisseur ou un document</label>
    <select id="cdiDocumentSupplier">
      <option value="">Document général de l'expédition</option>
    </select>
    <input type="file" id="cdiDocumentFile">
    <button type="button" data-action="upload-document">ARCHIVER DOCUMENT</button>

    <label>Ajouter des photos des marchandises</label>
    <input type="file" id="cdiPhotoFiles" accept="image/*" multiple>
    <button type="button" data-action="upload-photos">ARCHIVER PHOTOS</button>

    <div id="cdiDocumentsList"></div>

    <hr>
    <button type="button" data-action="print">🖨️ IMPRIMER LE DOSSIER</button>
    <button type="button" data-action="new">➕ NOUVELLE EXPÉDITION</button>
  `;

  return root;
}

function cdiFormat(value) {
  return safeNumber(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 2
  });
}

function renderSuppliers() {
  const list = document.getElementById('cdiSuppliersList');
  const select = document.getElementById('cdiItemSupplier');
  const documentSelect = document.getElementById('cdiDocumentSupplier');

  if (!list || !select || !documentSelect) return;

  list.innerHTML = suppliers.map(function (supplier, index) {
    return `
      <div style="border:1px solid #aaa;padding:9px;margin:8px 0;border-radius:6px">
        <strong>Fournisseur ${index + 1} : ${escapeHTML(supplier.supplier_name)}</strong>
        <p>Contact : ${escapeHTML(supplier.contact_details)}</p>
        <p>Facture : ${escapeHTML(supplier.invoice_reference)}</p>
        <p>Devise : ${escapeHTML(supplier.currency)}</p>
        <p>${escapeHTML(supplier.notes)}</p>
      </div>
    `;
  }).join('');

  select.innerHTML = '<option value="">Choisir un fournisseur</option>' +
    suppliers.map(function (supplier, index) {
      return `<option value="${index}">${escapeHTML(supplier.supplier_name)}</option>`;
    }).join('');

  documentSelect.innerHTML =
    '<option value="">Document général de l’expédition</option>' +
    suppliers.map(function (supplier) {
      return supplier.db_id
        ? `<option value="${escapeHTML(supplier.db_id)}">${escapeHTML(supplier.supplier_name)}</option>`
        : '';
    }).join('');
}

function renderItems() {
  const list = document.getElementById('cdiItemsList');
  if (!list) return;

  list.innerHTML = items.map(function (item, index) {
    let cbm = safeNumber(item.cbm);

    try {
      if (safeNumber(item.carton_quantity) > 0) {
        cbm = calculateItemCbm(item).total_cbm;
      }
    } catch (error) {}

    const supplier = getItemSupplier(item);
    let statusAction = '';

    if (item.db_id && item.status === 'Draft') {
      statusAction = `<button type="button" data-action="arrived" data-index="${index}">CONFIRMER ARRIVÉE</button>`;
    } else if (item.db_id && item.status === 'Arrived') {
      statusAction = `<button type="button" data-action="receive" data-index="${index}">RÉCEPTIONNER DANS INVENTAIRE</button>`;
    } else if (item.status === 'Received') {
      statusAction = '<strong>✅ Réceptionné dans Inventaire</strong>';
    }

    return `
      <div style="border:1px solid #aaa;padding:10px;margin:9px 0;border-radius:6px">
        <strong>${index + 1}. ${escapeHTML(item.item_name)}</strong>
        <p>Fournisseur : ${escapeHTML(supplier ? supplier.supplier_name : 'Non défini')}</p>
        <p>Cartons : ${cdiFormat(item.carton_quantity)}</p>
        <p>Pièces par carton : ${cdiFormat(item.pieces_per_carton)}</p>
        <p>Quantité totale : ${cdiFormat(item.total_quantity)}</p>
        <p>CBM par carton : ${cdiFormat(item.cbm_per_carton)}</p>
        <p>CBM total : ${cdiFormat(cbm)}</p>
        <p>Prix d'achat : ${cdiFormat(item.purchase_unit_price)} ${escapeHTML(item.purchase_currency)}</p>
        <p>Coût total de revient : ${cdiFormat(item.landed_cost_bif)} BIF</p>
        <p>Prix de gros : ${cdiFormat(item.wholesale_price_bif)} BIF</p>
        <p>Prix de détail : ${cdiFormat(item.retail_price_bif)} BIF</p>
        <p>Statut : ${escapeHTML(item.status || 'Draft')}</p>
        <p>${escapeHTML(item.notes)}</p>
        ${statusAction}
      </div>
    `;
  }).join('');
}

function renderCosts() {
  const list = document.getElementById('cdiCostsList');
  if (!list) return;

  list.innerHTML = costs.map(function (cost, index) {
    return `
      <div style="border:1px solid #aaa;padding:8px;margin:7px 0">
        <strong>${index + 1}. ${escapeHTML(cost.company_name)}</strong>
        <p>${escapeHTML(cost.service_description)}</p>
        <p>Facture : ${escapeHTML(cost.invoice_reference)}</p>
        <p>Montant : ${cdiFormat(cost.amount)} ${escapeHTML(cost.currency)}</p>
      </div>
    `;
  }).join('');
}

function renderCalculation() {
  const target = document.getElementById('cdiCalculationResult');
  if (!target) return;

  try {
    const result = calculateShipmentSellingPrices();
    const landed = result.landed_costs;

    target.innerHTML = `
      <div style="border:1px solid #888;padding:12px;margin-top:10px;border-radius:7px">
        <h3>Résumé de l'expédition</h3>
        <p>Total cartons : <strong>${cdiFormat(landed.total_cartons)}</strong></p>
        <p>Total CBM : <strong>${cdiFormat(landed.total_cbm)}</strong></p>
        <p>Total achats : <strong>${cdiFormat(landed.total_purchase_usd)} USD</strong></p>
        <p>Total transport : <strong>${cdiFormat(landed.total_transport_usd)} USD</strong></p>
        <p>Total documents : <strong>${cdiFormat(landed.total_document_usd)} USD</strong></p>
        <p>Autres frais communs : <strong>${cdiFormat(landed.total_common_expenses_usd)} USD</strong></p>
        <h3>Coût total : ${cdiFormat(landed.total_landed_usd)} USD</h3>
        <h3>Équivalent : ${cdiFormat(landed.total_landed_bif)} BIF</h3>
        <hr>
        <p>Bénéfice potentiel au prix de gros : <strong>${cdiFormat(result.total_potential_wholesale_profit_bif)} BIF</strong></p>
        <p>Bénéfice potentiel au prix de détail : <strong>${cdiFormat(result.total_potential_retail_profit_bif)} BIF</strong></p>
        <p><em>Il s'agit d'un bénéfice potentiel, pas encore d'une vente réelle.</em></p>
      </div>
    `;

    renderItems();
  } catch (error) {
    target.innerHTML =
      `<p style="color:#b00020">${escapeHTML(error.message)}</p>`;
  }
}

function renderDocuments(documents) {
  const list = document.getElementById('cdiDocumentsList');
  if (!list) return;

  list.innerHTML = (documents || []).map(function (doc) {
    return `
      <div style="border-bottom:1px solid #aaa;padding:8px">
        <strong>${escapeHTML(doc.original_name || doc.document_type || 'Document')}</strong>
        <p>Type : ${escapeHTML(doc.document_type)}</p>
        <button type="button" data-action="open-document"
          data-path="${escapeHTML(doc.document_path)}">OUVRIR</button>
      </div>
    `;
  }).join('');
}

function setCDILocked(locked) {
  const editor = document.getElementById('cdiEditor');
  if (!editor) return;

  editor.querySelectorAll('input, select, textarea, button[data-edit]')
    .forEach(function (element) {
      element.disabled = locked;
    });
}

function clearCDIForm() {
  suppliers = [];
  items = [];
  costs = [];
  currentShipment = null;
  currentShipmentId = null;

  const ids = [
    'cdiShipmentReference', 'cdiShipmentNotes',
    'cdiSupplierName', 'cdiSupplierContact',
    'cdiSupplierInvoice', 'cdiSupplierNotes',
    'cdiItemName', 'cdiItemCategory', 'cdiItemUnit',
    'cdiItemCartons', 'cdiItemPieces', 'cdiItemCbmPerCarton',
    'cdiItemLength', 'cdiItemWidth', 'cdiItemHeight',
    'cdiItemNetWeight', 'cdiItemGrossWeight',
    'cdiItemPurchasePrice', 'cdiItemTransport',
    'cdiItemCustoms', 'cdiItemOther',
    'cdiItemWholesale', 'cdiItemRetail', 'cdiItemNotes',
    'cdiCostCompany', 'cdiCostDescription',
    'cdiCostInvoice', 'cdiCostAmount', 'cdiCostNotes'
  ];

  ids.forEach(function (id) {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('cdiShipmentDate').value = today;
  document.getElementById('cdiSourceCountry').value = 'China';
  document.getElementById('cdiSupplierCurrency').value = 'USD';
  document.getElementById('cdiItemCurrency').value = 'USD';
  document.getElementById('cdiCostCurrency').value = 'BIF';
  document.getElementById('cdiItemUnit').value = 'pieces';
  document.getElementById('cdiItemCbmMode').value = 'per_carton';

  document.getElementById('cdiCalculationResult').innerHTML = '';
  document.getElementById('cdiDocumentsList').innerHTML = '';

  setCDILocked(false);
  renderSuppliers();
  renderItems();
  renderCosts();
}

async function performCDISearch() {
  const results = await searchShipment(val('cdiSearchNumber'));
  const target = document.getElementById('cdiSearchResults');

  if (!target) return;

  if (!results.length) {
    target.innerHTML = '<p>Aucune expédition trouvée.</p>';
    return;
  }

  target.innerHTML = results.map(function (shipment) {
    return `
      <div style="border-bottom:1px solid #aaa;padding:8px">
        <strong>${escapeHTML(shipment.shipment_number || shipment.id)}</strong>
        <p>${escapeHTML(shipment.source_country)} — ${escapeHTML(shipment.shipment_date)}</p>
        <button type="button" data-action="load"
          data-id="${escapeHTML(shipment.id)}">OUVRIR CE DOSSIER</button>
      </div>
    `;
  }).join('');
}

async function handleCDIClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;

  try {
    if (action === 'search') {
      await performCDISearch();
    }

    if (action === 'add-supplier') {
      addSupplier({
        supplier_name: val('cdiSupplierName'),
        contact_details: val('cdiSupplierContact'),
        invoice_reference: val('cdiSupplierInvoice'),
        currency: val('cdiSupplierCurrency'),
        notes: val('cdiSupplierNotes')
      });

      document.getElementById('cdiSupplierName').value = '';
      document.getElementById('cdiSupplierContact').value = '';
      document.getElementById('cdiSupplierInvoice').value = '';
      document.getElementById('cdiSupplierNotes').value = '';
      renderSuppliers();
    }

    
    if (action === 'add-item') {
      const previousItemCount = items.length;

      try {
        const item = addItem({
          supplierIndex: val('cdiItemSupplier'),
          item_name: val('cdiItemName'),
          category: val('cdiItemCategory'),
          unit: val('cdiItemUnit') || 'pieces',
          carton_quantity: nval('cdiItemCartons'),
          pieces_per_carton: nval('cdiItemPieces'),
          cbm_entry_mode: val('cdiItemCbmMode'),
          cbm_per_carton: nval('cdiItemCbmPerCarton'),
          carton_length_cm: nval('cdiItemLength'),
          carton_width_cm: nval('cdiItemWidth'),
          carton_height_cm: nval('cdiItemHeight'),
          net_weight_per_carton_kg: nval('cdiItemNetWeight'),
          gross_weight_per_carton_kg: nval('cdiItemGrossWeight'),
          purchase_currency: val('cdiItemCurrency'),
          purchase_unit_price: nval('cdiItemPurchasePrice'),
          transport_cost_bif: nval('cdiItemTransport'),
          customs_cost_bif: nval('cdiItemCustoms'),
          other_costs_bif: nval('cdiItemOther'),
          wholesale_price_bif: nval('cdiItemWholesale'),
          retail_price_bif: nval('cdiItemRetail'),
          notes: val('cdiItemNotes')
        });

        calculateItemQuantities(item);
        calculateItemCbm(item);
        renderItems();

      } catch (error) {
        items.splice(previousItemCount);
        throw error;
      }
    }


    if (action === 'add-cost') {
      addCost({
        company_name: val('cdiCostCompany'),
        service_description: val('cdiCostDescription'),
        invoice_reference: val('cdiCostInvoice'),
        currency: val('cdiCostCurrency'),
        amount: nval('cdiCostAmount'),
        notes: val('cdiCostNotes')
      });

      renderCosts();
    }

    if (action === 'calculate') {
      renderCalculation();
    }

    if (action === 'save') {
      if (currentShipmentId) {
        throw new Error('Ce dossier est déjà enregistré. Utilisez NOUVELLE EXPÉDITION pour créer un autre dossier.');
      }

      if (isSaving) return;

      button.disabled = true;
      const shipment = await saveShipment();
      button.disabled = false;

      if (shipment && shipment.id) {
        setCDILocked(true);
        renderCalculation();
      }
    }

    if (action === 'load') {
      const result = await loadShipment(button.dataset.id);

      if (result) {
        document.getElementById('cdiSourceCountry').value =
          result.shipment.source_country || 'China';
        document.getElementById('cdiShipmentDate').value =
          result.shipment.shipment_date || '';
        document.getElementById('cdiShipmentReference').value =
          result.shipment.shipment_reference || '';
        document.getElementById('cdiShipmentNotes').value =
          result.shipment.notes || '';

        renderSuppliers();
        renderItems();
        renderCosts();
        renderDocuments(result.documents);
        renderCalculation();
        setCDILocked(true);
      }
    }

    if (action === 'arrived') {
      const item = items[Number(button.dataset.index)];
      if (item && item.db_id) {
        const success = await setArrived(item.db_id);
        if (success) {
          const result = await loadShipment(currentShipmentId);
          if (result) {
            renderItems();
            setCDILocked(true);
          }
        }
      }
    }

    if (action === 'receive') {
      const item = items[Number(button.dataset.index)];
      if (item && item.db_id) {
        const resultReceipt = await receiveItem(item.db_id);
        if (resultReceipt) {
          const result = await loadShipment(currentShipmentId);
          if (result) {
            renderItems();
            setCDILocked(true);
          }
        }
      }
    }

    if (action === 'upload-document') {
      const fileInput = document.getElementById('cdiDocumentFile');
      const file = fileInput.files[0];

      if (!currentShipmentId) {
        throw new Error('Enregistrez ou ouvrez une expédition avant d’archiver un document.');
      }

      const supplierId = val('cdiDocumentSupplier') || null;
      const document = await uploadShipmentDocument(file, 'Supplier Invoice / Document', supplierId);

      if (document) {
        const result = await loadShipment(currentShipmentId);
        if (result) renderDocuments(result.documents);
        fileInput.value = '';
      }
    }

    if (action === 'upload-photos') {
      const photoInput = document.getElementById('cdiPhotoFiles');

      if (!currentShipmentId) {
        throw new Error('Enregistrez ou ouvrez une expédition avant d’ajouter des photos.');
      }

      const uploaded = await uploadShipmentPhotos(photoInput.files);

      if (uploaded.length) {
        const result = await loadShipment(currentShipmentId);
        if (result) renderDocuments(result.documents);
        photoInput.value = '';
      }
    }

    if (action === 'open-document') {
      await openShipmentDocument(button.dataset.path);
    }

    if (action === 'print') {
      printShipment();
    }

    if (action === 'new') {
      if (currentShipmentId &&
          !confirm('Créer une nouvelle expédition ? Le dossier actuel restera enregistré.')) {
        return;
      }

      clearCDIForm();
    }

  } catch (error) {
    console.error('CDI interface error:', error);
    alert(error.message || 'Une erreur est survenue.');
  }
}

function handleCDIChange(event) {
  if (event.target.id === 'cdiItemCbmMode') {
    const dimensions = event.target.value === 'dimensions';
    document.getElementById('cdiCbmPerCartonField').hidden = dimensions;
    document.getElementById('cdiCbmDimensionsField').hidden = !dimensions;
  }
}

function initializeChinaDubaiImport() {
  if (initialized) return;

  const root = buildCDIInterface();
  if (!root) return;

  if (root.dataset.cdiEvents !== 'ready') {
    root.addEventListener('click', handleCDIClick);
    root.addEventListener('change', handleCDIChange);
    root.dataset.cdiEvents = 'ready';
  }

  initialized = true;
  clearCDIForm();
}

window.cwbInitChinaDubaiImport = initializeChinaDubaiImport;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChinaDubaiImport);
} else {
  initializeChinaDubaiImport();
}
   
})();

