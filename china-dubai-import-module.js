
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

  const ALLOCATION_METHODS = [
    'CBM',
    'CARTONS',
    'PURCHASE_VALUE'
  ];

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

    notes: data.notes || ''
  };

  items.push(item);
  return item;
}

function getItemSupplier(item) {
  const index = Number(item.supplierIndex);

  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return suppliers[index] || null;
}

function validateSuppliers() {
  if (!suppliers.length) {
    throw new Error('Ajoutez au moins un fournisseur.');
  }

  suppliers.forEach(function (supplier, index) {
    if (!supplier.supplier_name.trim()) {
      throw new Error(
        'Le nom du fournisseur numéro ' + (index + 1) + ' est obligatoire.'
      );
    }
  });

  return true;
}

function validateItems() {
  if (!items.length) {
    throw new Error('Ajoutez au moins un article à cette expédition.');
  }

  items.forEach(function (item, index) {
    const number = index + 1;

    if (!item.item_name.trim()) {
      throw new Error('Le nom de l’article numéro ' + number + ' est obligatoire.');
    }

    if (!getItemSupplier(item)) {
      throw new Error(
        'Veuillez sélectionner le fournisseur de l’article : ' + item.item_name
      );
    }

    if (safeNumber(item.carton_quantity) <= 0) {
      throw new Error('Le nombre de cartons est obligatoire pour : ' + item.item_name);
    }

    if (safeNumber(item.pieces_per_carton) <= 0) {
      throw new Error('Le nombre de pièces par carton est obligatoire pour : ' + item.item_name);
    }

    if (safeNumber(item.purchase_unit_price) < 0) {
      throw new Error('Le prix d’achat ne peut pas être négatif : ' + item.item_name);
    }

    if (!CURRENCIES.includes(item.purchase_currency)) {
      throw new Error('Devise invalide pour : ' + item.item_name);
    }
  });

  return true;
}

function roundVolume(value) {
  return Math.round(
    (safeNumber(value) + Number.EPSILON) * 1000000
  ) / 1000000;
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
  const rmbToUsd = nval('cdiRmbRate');

  if (usdToBif <= 0) {
    throw new Error(
      'Veuillez entrer un taux USD vers BIF valide.'
    );
  }

  if (rmbToUsd <= 0) {
    throw new Error(
      'Veuillez entrer un taux RMB vers USD valide.'
    );
  }

  return {
    usd_to_bif: usdToBif,
    rmb_to_usd: rmbToUsd
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
  const method = val('cdiAllocationMethod') || 'CBM';

  if (!ALLOCATION_METHODS.includes(method)) {
    throw new Error('Méthode de répartition des frais invalide.');
  }

  return method;
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

    const result = await db
      .from(TABLES.shipments)
      .select('*')
      .ilike('shipment_number', '%' + query + '%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (result.error) {
      throw result.error;
    }

    return result.data || [];

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
    if (rmbRate) rmbRate.value = shipment.rmb_to_usd_rate || '';
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
          <p>Taux RMB/USD : ${rates.rmb_to_usd}</p>
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
