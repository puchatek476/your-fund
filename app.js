const ASSET_CATALOG = {
  gold_ounce: {
    name: "Złoto fizyczne",
    label: "Złoto fizyczne (uncje trojańskie)",
    unit: "oz",
    quantityLabel: "uncje trojańskie",
    allocationColor: "#e7b44c"
  },
  emim_as: {
    name: "iShares Core MSCI Emerging Markets IMI UCITS ETF (Acc)",
    label: "iShares Core MSCI Emerging Markets IMI UCITS ETF (Acc) (EMIM.AS)",
    unit: "szt.",
    allocationColor: "#48ba8d"
  },
  iwda_as: {
    name: "iShares Core MSCI World UCITS ETF (Acc)",
    label: "iShares Core MSCI World UCITS ETF (Acc) (IWDA.AS)",
    unit: "szt.",
    allocationColor: "#69a6ff"
  },
  pl_treasury_bond: {
    name: "Polskie obligacje skarbowe",
    label: "Obligacje skarbowe PL",
    unit: "szt.",
    allocationColor: "#bc8eff"
  },
  etfbw20tr: {
    name: "ETF Beta WIG20TR",
    label: "ETF Beta WIG20TR (ETFBW20TR)",
    unit: "szt.",
    allocationColor: "#ff8a65"
  }
};

const BOND_ISSUE_PATTERN = /^(OTS|ROR|DOR|TOS|COI|EDO|ROS|ROD)[0-9]{4}$/;

const elements = {
  authScreen: document.querySelector("#auth-screen"),
  appScreen: document.querySelector("#app-screen"),
  authForm: document.querySelector("#auth-form"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authMessage: document.querySelector("#auth-message"),
  grandTotal: document.querySelector("#grand-total"),
  grandPerformance: document.querySelector("#grand-performance"),
  portfolioList: document.querySelector("#portfolio-list"),
  selectedPortfolioName: document.querySelector("#selected-portfolio-name"),
  selectedPortfolioCaption: document.querySelector("#selected-portfolio-caption"),
  assetsSummary: document.querySelector("#assets-summary"),
  assetAllocation: document.querySelector("#asset-allocation"),
  allocationTotal: document.querySelector("#allocation-total"),
  allocationBar: document.querySelector("#allocation-bar"),
  allocationLegend: document.querySelector("#allocation-legend"),
  assetList: document.querySelector("#asset-list"),
  saveStatus: document.querySelector("#save-status"),
  assetLocation: document.querySelector("#asset-location"),
  assetDialog: document.querySelector("#asset-dialog"),
  assetForm: document.querySelector("#asset-form"),
  assetDialogTitle: document.querySelector("#asset-dialog-title"),
  assetDialogCaption: document.querySelector("#asset-dialog-caption"),
  assetCode: document.querySelector("#asset-code"),
  assetQuantity: document.querySelector("#asset-quantity"),
  assetQuantityLabel: document.querySelector("#asset-quantity-label"),
  assetPurchasePrice: document.querySelector("#asset-purchase-price"),
  assetPurchasePriceLabel: document.querySelector("#asset-purchase-price-label"),
  assetPurchaseDate: document.querySelector("#asset-purchase-date"),
  bondFields: document.querySelector("#bond-fields"),
  bondIssueCode: document.querySelector("#bond-issue-code"),
  saveAssetButton: document.querySelector("#save-asset-button"),
  locationDialog: document.querySelector("#location-dialog"),
  locationAddForm: document.querySelector("#location-add-form"),
  newLocationName: document.querySelector("#new-location-name"),
  locationList: document.querySelector("#location-list"),
  addLocationSubmit: document.querySelector("#add-location-submit"),
  priceDialog: document.querySelector("#price-dialog"),
  priceForm: document.querySelector("#price-form"),
  priceDialogCaption: document.querySelector("#price-dialog-caption"),
  priceDialogTitle: document.querySelector("#price-dialog-title"),
  priceDialogNote: document.querySelector("#price-dialog-note"),
  priceDateField: document.querySelector("#price-date-field"),
  priceRecordedOn: document.querySelector("#price-recorded-on"),
  priceType: document.querySelector("#price-type"),
  priceAmount: document.querySelector("#price-amount"),
  priceAmountLabel: document.querySelector("#price-amount-label"),
  savePriceButton: document.querySelector("#save-price-button")
};

const supabaseUrl = window.SUPABASE_URL?.trim();
const supabaseAnonKey = window.SUPABASE_ANON_KEY?.trim();
let supabaseClient = null;
let supabaseConfigError = null;
try {
  if (window.supabase && supabaseUrl && supabaseAnonKey) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (error) {
  supabaseConfigError = error.message;
}

let portfolios = [];
let positions = [];
let locations = [];
let priceHistory = [];
let selectedPortfolioSlug = null;
let currentUser = null;
let loadingUserId = null;
let editingPositionId = null;
let pricingPositionId = null;
let editingPriceHistoryId = null;

function formatMoney(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatQuantity(value) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 8 }).format(value);
}

function pluralize(count, many, singular, plural) {
  if (count === 1) return singular;
  const lastTwo = count % 100;
  const last = count % 10;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? plural : many;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getPriceAmountInPln(entry) {
  let amount = Number(entry.amount);
  if (entry.currency?.trim() === "EUR") {
    const eurPlnRate = Number(entry.eur_pln_rate);
    if (!Number.isFinite(eurPlnRate) || eurPlnRate <= 0) return null;
    amount *= eurPlnRate;
  }
  return Number.isFinite(amount) ? amount : null;
}

function getPositionPrice(position) {
  const definition = ASSET_CATALOG[position.asset_code];
  const entries = priceHistory.filter(item => item.position_id === position.id);
  const entry = entries[entries.length - 1];
  if (!definition || !entry) return null;
  const amount = getPriceAmountInPln(entry);
  if (amount === null) return null;
  return {
    unitPrice: entry.price_type === "unit" ? amount : amount / Number(position.quantity),
    amount,
    priceType: entry.price_type,
    recordedOn: entry.recorded_on
  };
}

function getPlnValue(position) {
  const price = getPositionPrice(position);
  if (!price) return null;
  return {
    unitPrice: price.unitPrice,
    value: price.priceType === "total" ? price.amount : price.unitPrice * Number(position.quantity),
    recordedOn: price.recordedOn
  };
}

function getPositionPerformance(position, valued = getPlnValue(position)) {
  if (!valued || position.purchase_unit_price == null) return null;
  const quantity = Number(position.quantity);
  const purchaseUnitPrice = Number(position.purchase_unit_price);
  if (!Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(purchaseUnitPrice) || purchaseUnitPrice < 0) return null;

  const costBasis = quantity * purchaseUnitPrice;
  const gain = valued.value - costBasis;
  return {
    gain,
    costBasis,
    returnRate: costBasis > 0 ? gain / costBasis * 100 : null
  };
}

function summarizePositions(owned) {
  let value = 0;
  let unpriced = 0;
  let gain = 0;
  let costBasis = 0;
  let performanceCount = 0;
  for (const position of owned) {
    const valued = getPlnValue(position);
    if (!valued) {
      unpriced += 1;
      continue;
    }

    value += valued.value;
    const performance = getPositionPerformance(position, valued);
    if (performance) {
      gain += performance.gain;
      costBasis += performance.costBasis;
      performanceCount += 1;
    }
  }
  return {
    value,
    unpriced,
    count: owned.length,
    gain,
    costBasis,
    performanceCount,
    returnRate: costBasis > 0 ? gain / costBasis * 100 : null
  };
}

function getPortfolioValue(portfolioSlug) {
  return summarizePositions(positions.filter(position => position.portfolio_slug === portfolioSlug));
}

function formatReturnRate(value) {
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return `${value >= 0 ? "+" : ""}${formatted}%`;
}

function formatPerformanceSummary(summary) {
  if (!summary.performanceCount) return "Wynik: brak danych · Stopa zwrotu: —";
  const gain = `${summary.gain >= 0 ? "+" : ""}${formatMoney(summary.gain)}`;
  const returnRate = summary.returnRate === null ? "n/d" : formatReturnRate(summary.returnRate);
  return `Wynik: ${gain} · Stopa zwrotu: ${returnRate}`;
}

function performanceTitle() {
  return "Wynik uwzględnia aktywa z podaną ceną zakupu i aktualną wyceną.";
}

function resultPerformanceClass(summary) {
  if (!summary.performanceCount) return "";
  return summary.gain >= 0 ? "positive" : "negative";
}

function formatAllocationShare(value) {
  return `${new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }).format(value)}%`;
}

function renderAssetAllocation(portfolioPositions) {
  const categories = new Map();
  let total = 0;
  let unpriced = 0;

  for (const position of portfolioPositions) {
    const definition = ASSET_CATALOG[position.asset_code];
    const valued = getPlnValue(position);
    if (!definition || !valued) {
      unpriced += 1;
      continue;
    }

    total += valued.value;
    const category = categories.get(position.asset_code) ?? {
      name: definition.name,
      color: definition.allocationColor,
      value: 0
    };
    category.value += valued.value;
    categories.set(position.asset_code, category);
  }

  elements.allocationTotal.textContent = total
    ? `Wycena: ${formatMoney(total)}${unpriced ? ` · ${unpriced} bez ceny` : ""}`
    : unpriced ? `${unpriced} ${pluralize(unpriced, "aktywów bez wyceny", "aktywo bez wyceny", "aktywa bez wyceny")}` : "Brak aktywów";
  elements.allocationBar.replaceChildren();
  elements.allocationLegend.replaceChildren();
  elements.allocationBar.hidden = total === 0;

  if (total === 0) {
    elements.allocationBar.removeAttribute("aria-label");
    elements.allocationLegend.append(
      makeElement("p", "allocation-empty", unpriced ? "Dodaj aktualne ceny, aby zobaczyć strukturę portfela." : "Dodaj aktywa, aby zobaczyć strukturę portfela.")
    );
    return;
  }

  const sortedCategories = [...categories.values()].sort((left, right) => right.value - left.value);
  const descriptions = [];
  for (const category of sortedCategories) {
    const share = category.value / total * 100;
    descriptions.push(`${category.name}: ${formatAllocationShare(share)}`);

    const segment = makeElement("span", "allocation-segment");
    segment.style.flexBasis = `${share}%`;
    segment.style.backgroundColor = category.color;
    segment.setAttribute("aria-hidden", "true");
    elements.allocationBar.append(segment);

    const item = makeElement("div", "allocation-item");
    const swatch = makeElement("span", "allocation-swatch");
    swatch.style.backgroundColor = category.color;
    swatch.setAttribute("aria-hidden", "true");
    const details = makeElement("span", "allocation-details");
    details.append(
      makeElement("span", "allocation-share", formatAllocationShare(share)),
      makeElement("span", "allocation-value", formatMoney(category.value))
    );
    item.append(swatch, makeElement("span", "allocation-name", category.name), details);
    elements.allocationLegend.append(item);
  }
  elements.allocationBar.setAttribute(
    "aria-label",
    `Udział typów aktywów w wycenionych aktywach portfela: ${descriptions.join(", ")}`
  );
}

function render() {
  const summary = summarizePositions(positions);

  elements.grandTotal.textContent = `${formatMoney(summary.value)}${summary.unpriced ? " +" : ""}`;
  elements.grandPerformance.textContent = formatPerformanceSummary(summary);
  elements.grandPerformance.className = `return-summary${summary.performanceCount ? summary.gain >= 0 ? " positive" : " negative" : ""}`;
  elements.grandPerformance.title = performanceTitle();
  elements.grandTotal.title = summary.unpriced
    ? `${summary.unpriced} ${pluralize(summary.unpriced, "pozycji bez wyceny", "pozycja bez wyceny", "pozycje bez wyceny")}`
    : "";
  elements.portfolioList.replaceChildren();

  if (!portfolios.some(portfolio => portfolio.slug === selectedPortfolioSlug)) {
    selectedPortfolioSlug = portfolios[0]?.slug ?? null;
  }

  for (const portfolio of portfolios) {
    const result = getPortfolioValue(portfolio.slug);
    const button = makeElement("button", `portfolio-card${portfolio.slug === selectedPortfolioSlug ? " is-selected" : ""}`);
    button.type = "button";
    button.setAttribute("aria-pressed", String(portfolio.slug === selectedPortfolioSlug));
    button.addEventListener("click", () => {
      selectedPortfolioSlug = portfolio.slug;
      render();
    });
    const top = makeElement("span", "portfolio-card-top");
    top.append(
      makeElement("span", "portfolio-name", portfolio.name),
      makeElement("span", "portfolio-count", `${result.count} ${pluralize(result.count, "aktywów", "aktywo", "aktywa")}`)
    );
    const performance = makeElement(
      "span",
      `portfolio-performance${result.performanceCount ? result.gain >= 0 ? " positive" : " negative" : ""}`,
      formatPerformanceSummary(result)
    );
    performance.title = performanceTitle();
    button.append(
      top,
      makeElement("span", "portfolio-amount", `${formatMoney(result.value)}${result.unpriced ? " +" : ""}`),
      performance
    );
    elements.portfolioList.append(button);
  }

  const selected = portfolios.find(portfolio => portfolio.slug === selectedPortfolioSlug);
  elements.assetList.replaceChildren();
  elements.assetsSummary.replaceChildren();
  if (!selected) {
    elements.assetAllocation.hidden = true;
    elements.selectedPortfolioName.textContent = "Brak portfeli";
    elements.selectedPortfolioCaption.textContent = "Sprawdź konfigurację bazy";
    return;
  }

  elements.selectedPortfolioCaption.textContent = "Wybrany portfel";
  elements.selectedPortfolioName.textContent = selected.name;
  const selectedValue = getPortfolioValue(selected.slug);
  const selectedPerformance = makeElement(
    "span",
    resultPerformanceClass(selectedValue),
    formatPerformanceSummary(selectedValue)
  );
  selectedPerformance.title = performanceTitle();
  elements.assetsSummary.append(
    makeElement("span", "", `${selectedValue.count} ${pluralize(selectedValue.count, "aktywów", "aktywo", "aktywa")}`),
    makeElement("span", "", `Wartość: ${formatMoney(selectedValue.value)}${selectedValue.unpriced ? " +" : ""}`),
    selectedPerformance
  );
  const selectedPositions = positions.filter(position => position.portfolio_slug === selected.slug);
  elements.assetAllocation.hidden = false;
  renderAssetAllocation(selectedPositions);
  if (selectedPositions.length === 0) {
    const empty = makeElement("div", "empty-state");
    empty.append(
      makeElement("strong", "", "Ten portfel jest jeszcze pusty"),
      makeElement("p", "", "Dodaj aktywo z katalogu, aby zobaczyć jego wartość.")
    );
    elements.assetList.append(empty);
  } else {
    selectedPositions.forEach(position => elements.assetList.append(renderPosition(position)));
  }

}

function renderPosition(position) {
  const definition = ASSET_CATALOG[position.asset_code];
  const valued = getPlnValue(position);
  const performance = getPositionPerformance(position, valued);
  const card = makeElement("article", "asset-card");
  const main = makeElement("div", "asset-main");
  const identity = makeElement("div", "asset-identity");
  const initials = position.asset_code === "gold_ounce" ? "Au"
    : position.asset_code === "pl_treasury_bond" ? "PL"
      : position.asset_code.slice(0, 2).toUpperCase();
  const symbol = makeElement("span", "asset-symbol", initials);
  symbol.setAttribute("aria-hidden", "true");
  const nameBlock = document.createElement("div");
  const meta = position.asset_code === "pl_treasury_bond"
    ? `${position.bond_issue_code} · ${formatQuantity(Number(position.quantity))} szt.`
    : `${formatQuantity(Number(position.quantity))} ${definition.unit}`;
  const locationName = locations.find(location => location.id === position.location_id)?.name ?? "Brak lokalizacji";
  nameBlock.append(makeElement("p", "asset-name", definition.name), makeElement("p", "asset-meta", `${meta} · ${locationName}`));
  identity.append(symbol, nameBlock);

  const value = makeElement("div", "asset-value");
  if (valued) {
    value.append(makeElement("strong", "", formatMoney(valued.value)));
    value.append(makeElement("span", "", `Cena: ${formatMoney(valued.unitPrice)}/${definition.unit}`));
    value.append(makeElement("span", "", `Wpis z ${formatDate(valued.recordedOn)}`));
    if (performance) {
      const returnRate = performance.returnRate === null ? "n/d" : formatReturnRate(performance.returnRate);
      value.append(makeElement(
        "span",
        performance.gain >= 0 ? "positive" : "negative",
        `Wynik: ${performance.gain >= 0 ? "+" : ""}${formatMoney(performance.gain)} · Stopa zwrotu: ${returnRate}`
      ));
    } else if (position.purchase_unit_price == null) {
      const notice = makeElement("span", "", "Brak ceny zakupu");
      notice.title = "Dodaj cenę zakupu, aby obliczyć zysk i stopę zwrotu.";
      value.append(notice);
    }
  } else {
    value.append(makeElement("strong", "", "Brak wyceny"));
    value.append(makeElement("span", "", "Dodaj aktualną cenę"));
  }

  const actions = makeElement("div", "asset-actions");
  const addPrice = makeElement("button", "text-button", "Dodaj aktualną cenę");
  addPrice.type = "button";
  addPrice.addEventListener("click", () => openPriceDialog(position));
  const edit = makeElement("button", "text-button", "Edytuj");
  edit.type = "button";
  edit.addEventListener("click", () => openAssetDialog(position));
  const remove = makeElement("button", "text-button danger", "Usuń");
  remove.type = "button";
  remove.addEventListener("click", () => void removePosition(position));
  actions.append(addPrice, edit, remove);
  main.append(identity, value);
  card.append(main, actions);

  const history = priceHistory.filter(entry => entry.position_id === position.id);
  const historyDetails = document.createElement("details");
  historyDetails.className = "price-history";
  const historySummary = makeElement("summary", "", `Historia cen (${history.length})`);
  historyDetails.append(historySummary);
  if (history.length) {
    const list = makeElement("ul", "price-history-list");
    for (const entry of [...history].reverse()) {
      const amount = getPriceAmountInPln(entry);
      const label = amount === null
        ? "stary wpis EUR bez kursu — kwotę PLN wpisz przy edycji"
        : entry.price_type === "unit"
          ? `Cena za jednostkę: ${formatMoney(amount)}`
          : `Wartość całej pozycji: ${formatMoney(amount)}`;
      const item = makeElement("li", "price-history-item");
      item.append(makeElement("span", "price-history-entry", `${formatDate(entry.recorded_on)} · ${label}`));
      const actions = makeElement("span", "price-history-actions");
      const edit = makeElement("button", "text-button", "Edytuj");
      edit.type = "button";
      edit.addEventListener("click", () => openPriceDialog(position, entry));
      const remove = makeElement("button", "text-button danger", "Usuń");
      remove.type = "button";
      remove.addEventListener("click", () => void removePriceHistoryEntry(position, entry, remove));
      actions.append(edit, remove);
      item.append(actions);
      list.append(item);
    }
    historyDetails.append(list);
  } else {
    historyDetails.append(makeElement("p", "price-history-empty", "Brak wpisów w historii."));
  }
  card.append(historyDetails);
  return card;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pl-PL");
}

function populateAssetSelector() {
  elements.assetCode.replaceChildren();
  for (const [code, definition] of Object.entries(ASSET_CATALOG)) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = definition.label;
    elements.assetCode.append(option);
  }
}

function populateLocationSelector(selectedLocationId = null) {
  elements.assetLocation.replaceChildren();
  for (const location of locations) {
    const option = document.createElement("option");
    option.value = location.id;
    option.textContent = location.name;
    elements.assetLocation.append(option);
  }
  if (selectedLocationId && locations.some(location => location.id === selectedLocationId)) {
    elements.assetLocation.value = selectedLocationId;
  }
}

function renderLocationList() {
  elements.locationList.replaceChildren();
  for (const location of locations) {
    const row = makeElement("div", "location-row");
    const field = document.createElement("div");
    const inputId = `location-name-${location.id}`;
    const label = makeElement("label", "", "Nazwa lokalizacji");
    label.htmlFor = inputId;
    const input = document.createElement("input");
    input.id = inputId;
    input.type = "text";
    input.maxLength = 80;
    input.value = location.name;
    input.required = true;
    const rename = makeElement("button", "button button-secondary", "Zmień nazwę");
    rename.type = "button";
    rename.addEventListener("click", () => void renameLocation(location, input, rename));
    field.append(label, input);
    row.append(field, rename);
    elements.locationList.append(row);
  }
}

function openLocationDialog() {
  renderLocationList();
  elements.locationAddForm.reset();
  elements.locationDialog.showModal();
  elements.newLocationName.focus();
}

function hasLocationName(name, exceptId = null) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return locations.some(location =>
    location.id !== exceptId && location.name.toLocaleLowerCase() === normalizedName
  );
}

async function addLocation(event) {
  event.preventDefault();
  const name = elements.newLocationName.value.trim();
  if (!currentUser || !name || hasLocationName(name)) {
    elements.saveStatus.textContent = !name
      ? "Wpisz nazwę lokalizacji."
      : hasLocationName(name)
        ? "Lokalizacja o takiej nazwie już istnieje."
        : "Zaloguj się ponownie.";
    return;
  }

  elements.addLocationSubmit.disabled = true;
  try {
    const sortOrder = locations.reduce((maximum, location) => Math.max(maximum, location.sort_order), 0) + 1;
    const { data, error } = await supabaseClient
      .from("asset_locations")
      .insert({ user_id: currentUser.id, name, sort_order: sortOrder })
      .select()
      .single();
    if (error) throw error;
    locations.push(data);
    locations.sort((left, right) => left.sort_order - right.sort_order);
    renderLocationList();
    const selectedLocationId = elements.assetLocation.value;
    populateLocationSelector(selectedLocationId);
    elements.locationAddForm.reset();
    elements.newLocationName.focus();
    elements.saveStatus.textContent = "Lokalizacja dodana";
  } catch (error) {
    elements.saveStatus.textContent = `Nie udało się dodać lokalizacji: ${error.message}`;
    console.error("Supabase location insert failed.", error);
  } finally {
    elements.addLocationSubmit.disabled = false;
  }
}

async function renameLocation(location, input, button) {
  const name = input.value.trim();
  if (!currentUser || !name || hasLocationName(name, location.id)) {
    elements.saveStatus.textContent = !name
      ? "Nazwa lokalizacji nie może być pusta."
      : hasLocationName(name, location.id)
        ? "Lokalizacja o takiej nazwie już istnieje."
        : "Zaloguj się ponownie.";
    return;
  }
  if (name === location.name) return;

  button.disabled = true;
  try {
    const { data, error } = await supabaseClient
      .from("asset_locations")
      .update({ name })
      .eq("id", location.id)
      .eq("user_id", currentUser.id)
      .select()
      .single();
    if (error) throw error;
    locations = locations.map(item => item.id === location.id ? data : item);
    renderLocationList();
    const selectedLocationId = elements.assetLocation.value;
    populateLocationSelector(selectedLocationId);
    render();
    elements.saveStatus.textContent = "Nazwa lokalizacji zmieniona";
  } catch (error) {
    elements.saveStatus.textContent = `Nie udało się zmienić nazwy lokalizacji: ${error.message}`;
    console.error("Supabase location update failed.", error);
  } finally {
    button.disabled = false;
  }
}

function updateAssetFields() {
  const definition = ASSET_CATALOG[elements.assetCode.value];
  if (!definition) return;
  const isBond = elements.assetCode.value === "pl_treasury_bond";
  elements.assetQuantityLabel.textContent = isBond ? "Liczba obligacji" : `Ilość (${definition.quantityLabel ?? definition.unit})`;
  elements.assetPurchasePriceLabel.textContent = "Cena zakupu za jednostkę (PLN, opcjonalnie)";
  elements.bondFields.hidden = !isBond;
  elements.bondIssueCode.required = isBond;
  elements.assetPurchaseDate.required = isBond;
  elements.assetPurchasePrice.step = "any";
}

function openAssetDialog(position = null) {
  editingPositionId = position?.id ?? null;
  elements.assetForm.reset();
  elements.assetDialogTitle.textContent = position ? "Edytuj aktywo" : "Dodaj aktywo";
  elements.assetDialogCaption.textContent = portfolios.find(item => item.slug === selectedPortfolioSlug)?.name ?? "";
  elements.saveAssetButton.textContent = position ? "Zapisz zmiany" : "Dodaj aktywo";
  elements.assetCode.disabled = Boolean(position);
  elements.assetCode.value = position?.asset_code ?? Object.keys(ASSET_CATALOG)[0];
  populateLocationSelector(position?.location_id ?? locations[0]?.id ?? null);
  updateAssetFields();

  if (position) {
    elements.assetQuantity.value = position.quantity;
    elements.assetPurchasePrice.value = position.purchase_unit_price ?? "";
    elements.assetPurchaseDate.value = position.purchase_date ?? "";
    elements.bondIssueCode.value = position.bond_issue_code ?? "";
  }

  elements.assetDialog.showModal();
  elements.assetCode.focus();
}

function updatePriceFields() {
  if (!positions.some(position => position.id === pricingPositionId)) return;
  const typeLabel = elements.priceType.value === "unit" ? "za jednostkę (PLN)" : "całej pozycji (PLN)";
  elements.priceAmountLabel.textContent = `Cena ${typeLabel}`;
}

function openPriceDialog(position, entry = null) {
  pricingPositionId = position.id;
  editingPriceHistoryId = entry?.id ?? null;
  elements.priceForm.reset();
  elements.priceDialogCaption.textContent = ASSET_CATALOG[position.asset_code].name;
  elements.priceDialogTitle.textContent = entry ? "Edytuj wpis historii" : "Dodaj aktualną cenę";
  elements.priceDateField.hidden = !entry;
  elements.priceRecordedOn.required = Boolean(entry);
  elements.priceRecordedOn.value = entry?.recorded_on ?? "";
  elements.priceType.value = entry?.price_type ?? "unit";
  const amount = entry ? getPriceAmountInPln(entry) : null;
  elements.priceAmount.value = entry && amount !== null ? amount : "";
  elements.priceDialogNote.textContent = entry
    ? amount === null
      ? "Poprzedni wpis nie ma kursu EUR/PLN. Podaj poprawną kwotę w PLN."
      : "Zmień kwotę lub datę wpisu. Zmiany zostaną zapisane w historii."
    : "Wpisz kwotę w PLN. Zostanie zapisana w historii z dzisiejszą datą.";
  updatePriceFields();
  elements.priceDialog.showModal();
  elements.priceAmount.focus();
}

function setAppButtonsDisabled(disabled) {
  document.querySelectorAll("#app-screen button:not(#signout-button)").forEach(button => {
    button.disabled = disabled;
  });
}

async function loadAccountData(userId) {
  const { data: portfolioRows, error: portfolioError } = await supabaseClient
    .from("app_portfolios")
    .select("slug, name, sort_order")
    .eq("user_id", userId)
    .order("sort_order");
  if (portfolioError) throw portfolioError;
  if (!portfolioRows || portfolioRows.length !== 4) {
    throw new Error("Baza musi zawierać dokładnie cztery portfele przypisane do konta.");
  }

  const [
    { data: positionRows, error: positionError },
    { data: priceRows, error: priceError },
    { data: locationRows, error: locationError }
  ] = await Promise.all([
    supabaseClient.from("asset_positions").select("*").order("created_at"),
    supabaseClient.from("asset_price_history").select("*").order("recorded_on").order("created_at"),
    supabaseClient.from("asset_locations").select("*").eq("user_id", userId).order("sort_order")
  ]);
  if (positionError) throw positionError;
  if (priceError) throw priceError;
  if (locationError) throw locationError;
  portfolios = portfolioRows;
  positions = positionRows ?? [];
  locations = locationRows ?? [];
  priceHistory = priceRows ?? [];
  selectedPortfolioSlug = portfolios[0]?.slug ?? null;
  populateLocationSelector(locations[0]?.id ?? null);
  render();
}

async function handleAuthSession(session) {
  if (!session) {
    currentUser = null;
    loadingUserId = null;
    portfolios = [];
    positions = [];
    locations = [];
    priceHistory = [];
    elements.appScreen.hidden = true;
    elements.authScreen.hidden = false;
    return;
  }
  if (currentUser?.id === session.user.id && (portfolios.length || loadingUserId === session.user.id)) return;

  currentUser = session.user;
  loadingUserId = session.user.id;
  portfolios = [];
  positions = [];
  locations = [];
  priceHistory = [];
  elements.authScreen.hidden = true;
  elements.appScreen.hidden = false;
  elements.grandTotal.textContent = "—";
  elements.saveStatus.textContent = "Wczytywanie danych z Supabase…";
  setAppButtonsDisabled(true);

  try {
    await loadAccountData(session.user.id);
    if (currentUser?.id !== session.user.id) return;
    loadingUserId = null;
    setAppButtonsDisabled(false);
    elements.saveStatus.textContent = "Dane wczytane";
  } catch (error) {
    if (currentUser?.id !== session.user.id) return;
    loadingUserId = null;
    elements.saveStatus.textContent = `Nie udało się wczytać danych: ${error.message}`;
    console.error("Supabase account load failed.", error);
  }
}

async function savePosition(fields) {
  if (!currentUser) throw new Error("Zaloguj się ponownie.");
  if (editingPositionId) {
    const { error } = await supabaseClient
      .from("asset_positions")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", editingPositionId)
      .eq("portfolio_slug", selectedPortfolioSlug);
    if (error) throw error;
    positions = positions.map(position => position.id === editingPositionId ? { ...position, ...fields } : position);
  } else {
    const { data, error } = await supabaseClient
      .from("asset_positions")
      .insert({ ...fields, portfolio_slug: selectedPortfolioSlug })
      .select()
      .single();
    if (error) throw error;
    positions.push(data);
  }
  render();
}

async function removePosition(position) {
  if (!window.confirm(`Usunąć „${ASSET_CATALOG[position.asset_code].name}” z portfela?`)) return;
  try {
    const { error } = await supabaseClient
      .from("asset_positions")
      .delete()
      .eq("id", position.id)
      .eq("portfolio_slug", position.portfolio_slug);
    if (error) throw error;
    positions = positions.filter(item => item.id !== position.id);
    render();
    elements.saveStatus.textContent = "Pozycja usunięta";
  } catch (error) {
    elements.saveStatus.textContent = `Nie udało się usunąć pozycji: ${error.message}`;
    console.error("Supabase position delete failed.", error);
  }
}

async function removePriceHistoryEntry(position, entry, button) {
  if (!currentUser) {
    elements.saveStatus.textContent = "Zaloguj się ponownie.";
    return;
  }
  const amount = getPriceAmountInPln(entry);
  const entryDescription = amount === null ? "wpis EUR bez kursu" : formatMoney(amount);
  if (!window.confirm(`Usunąć wpis ceny z ${formatDate(entry.recorded_on)} (${entryDescription})?`)) return;

  button.disabled = true;
  elements.saveStatus.textContent = "Usuwanie wpisu historii…";
  try {
    const { error } = await supabaseClient
      .from("asset_price_history")
      .delete()
      .eq("id", entry.id)
      .eq("position_id", position.id)
      .select("id")
      .single();
    if (error) throw error;
    priceHistory = priceHistory.filter(item => item.id !== entry.id);
    render();
    elements.saveStatus.textContent = "Wpis historii usunięty";
  } catch (error) {
    elements.saveStatus.textContent = `Nie udało się usunąć wpisu historii: ${error.message}`;
    console.error("Supabase price history delete failed.", error);
  } finally {
    button.disabled = false;
  }
}

function getLocalDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function savePriceHistory(event) {
  event.preventDefault();
  const position = positions.find(item => item.id === pricingPositionId);
  if (!currentUser || !position) {
    elements.saveStatus.textContent = "Nie można zapisać ceny: nie znaleziono aktywa. Odśwież stronę i spróbuj ponownie.";
    return;
  }

  const amount = Number(elements.priceAmount.value);
  const priceType = elements.priceType.value;
  const isEditing = Boolean(editingPriceHistoryId);
  if (!Number.isFinite(amount) || amount <= 0 ||
      (priceType !== "unit" && priceType !== "total")) {
    elements.saveStatus.textContent = "Wpisz poprawną cenę w PLN.";
    return;
  }
  if (isEditing && !elements.priceRecordedOn.value) {
    elements.saveStatus.textContent = "Podaj datę wpisu.";
    return;
  }

  elements.savePriceButton.disabled = true;
  elements.saveStatus.textContent = isEditing ? "Zapisywanie zmian wpisu…" : "Zapisywanie ceny…";
  try {
    const fields = {
      amount,
      price_type: priceType,
      currency: "PLN"
    };
    if (editingPriceHistoryId) {
      const { data, error } = await supabaseClient
        .from("asset_price_history")
        .update({ ...fields, recorded_on: elements.priceRecordedOn.value })
        .eq("id", editingPriceHistoryId)
        .eq("position_id", position.id)
        .select()
        .single();
      if (error) throw error;
      priceHistory = priceHistory.map(item => item.id === editingPriceHistoryId ? data : item);
    } else {
      const { data, error } = await supabaseClient
        .from("asset_price_history")
        .insert({ ...fields, position_id: position.id, recorded_on: getLocalDateString() })
        .select()
        .single();
      if (error) throw error;
      priceHistory.push(data);
    }
    priceHistory.sort((left, right) =>
      left.recorded_on.localeCompare(right.recorded_on) || left.created_at.localeCompare(right.created_at)
    );
    render();
    elements.priceDialog.close();
    editingPriceHistoryId = null;
    elements.saveStatus.textContent = isEditing ? "Wpis historii zaktualizowany" : "Cena zapisana w historii";
  } catch (error) {
    elements.saveStatus.textContent = `Nie udało się zapisać ceny: ${error.message}`;
    console.error(isEditing ? "Supabase price history update failed." : "Supabase price history insert failed.", error);
  } finally {
    elements.savePriceButton.disabled = false;
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify({ portfolios, positions, locations, priceHistory }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "moj-majatek-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

elements.authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient) {
    elements.authMessage.textContent = "Sprawdź konfigurację Supabase.";
    return;
  }
  const button = elements.authForm.querySelector("button[type=submit]");
  button.disabled = true;
  elements.authMessage.textContent = "Logowanie…";
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: elements.authEmail.value.trim(),
      password: elements.authPassword.value
    });
    if (error) throw error;
    if (!data.session) throw new Error("Logowanie nie zwróciło aktywnej sesji.");
    elements.authMessage.textContent = "Zalogowano. Wczytuję portfele…";
    await handleAuthSession(data.session);
  } catch (error) {
    elements.authMessage.textContent = `Nie udało się zalogować: ${error.message}`;
    console.error("Supabase authentication failed.", error);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#signout-button").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    elements.saveStatus.textContent = `Nie udało się wylogować: ${error.message}`;
    console.error("Supabase sign-out failed.", error);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#export-button").addEventListener("click", exportData);
document.querySelector("#add-asset-button").addEventListener("click", () => openAssetDialog());
document.querySelector("#manage-locations-button").addEventListener("click", openLocationDialog);
elements.assetCode.addEventListener("change", updateAssetFields);
elements.locationAddForm.addEventListener("submit", event => void addLocation(event));
elements.priceType.addEventListener("change", updatePriceFields);
elements.priceForm.addEventListener("submit", event => void savePriceHistory(event));

elements.assetForm.addEventListener("submit", async event => {
  event.preventDefault();
  const assetCode = elements.assetCode.value;
  const quantity = Number(elements.assetQuantity.value);
  const locationId = elements.assetLocation.value;
  const purchasePrice = elements.assetPurchasePrice.value === "" ? null : Number(elements.assetPurchasePrice.value);
  const isBond = assetCode === "pl_treasury_bond";
  const bondIssueCode = elements.bondIssueCode.value.trim().toUpperCase();
  const purchaseDate = elements.assetPurchaseDate.value || null;

  if (!ASSET_CATALOG[assetCode] || !locations.some(location => location.id === locationId) ||
      !Number.isFinite(quantity) || quantity <= 0 ||
      (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) ||
      (isBond && (!BOND_ISSUE_PATTERN.test(bondIssueCode) || !purchaseDate))) return;

  const fields = {
    asset_code: assetCode,
    quantity,
    location_id: locationId,
    purchase_unit_price: purchasePrice,
    purchase_date: purchaseDate,
    bond_issue_code: isBond ? bondIssueCode : null
  };
  const button = elements.saveAssetButton;
  button.disabled = true;
  try {
    await savePosition(fields);
    elements.assetDialog.close();
    elements.saveStatus.textContent = "Pozycja zapisana w Supabase";
  } catch (error) {
    elements.saveStatus.textContent = `Nie udało się zapisać pozycji: ${error.message}`;
    console.error("Supabase position save failed.", error);
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

populateAssetSelector();
updateAssetFields();

async function initialize() {
  if (!supabaseClient) {
    elements.authMessage.textContent = supabaseConfigError
      ? `Nieprawidłowa konfiguracja Supabase: ${supabaseConfigError}`
      : "Skonfiguruj adres projektu i klucz Supabase w pliku supabase-config.js.";
    return;
  }
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => void handleAuthSession(session), 0);
  });
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    await handleAuthSession(data.session);
  } catch (error) {
    elements.authMessage.textContent = `Nie udało się sprawdzić sesji: ${error.message}`;
    console.error("Supabase session initialization failed.", error);
  }
}

void initialize();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.error("Nie udało się zarejestrować trybu offline.", error);
    });
  });
}
