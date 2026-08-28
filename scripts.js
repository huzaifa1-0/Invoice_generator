document.addEventListener('DOMContentLoaded', function () {

  /* ============================================================
     Element references
     ============================================================ */
  const itemsList = document.getElementById('itemsList');
  const addItemBtn = document.getElementById('addItemBtn');
  const discountType = document.getElementById('discountType');
  const discountValueInput = document.getElementById('discountValue');
  const vatValueInput = document.getElementById('vatValue');
  const subtotalDisplay = document.getElementById('subtotalDisplay');
  const vatLabel = document.getElementById('vatLabel');
  const vatAmountDisplay = document.getElementById('vatAmountDisplay');
  const totalDisplay = document.getElementById('totalDisplay');
  const balanceDueDisplay = document.getElementById('balanceDueDisplay');
  const downloadBtn = document.getElementById('downloadBtn');
  const previewBtn = document.getElementById('previewBtn');
  const printBtn = document.getElementById('printBtn');
  const resetBtn = document.getElementById('resetBtn');

  const logoInput = document.getElementById('logoInput');
  const logoPreview = document.getElementById('logoPreview');
  const placeholderIcon = document.getElementById('placeholderIcon');
  const currencySelect = document.getElementById('currency');
  const currentCurrencyFlag = document.getElementById('currentCurrencyFlag');

  const toast = document.getElementById('toast');

  const FORM_FIELD_IDS = [
    'businessName', 'businessEmail', 'businessPhone', 'businessAddress',
    'template', 'invoiceNumber', 'billTo', 'billToEmail', 'billToAddress',
    'invoiceDate', 'dueDate', 'paymentTerms', 'poNumber', 'notes', 'terms'
  ];

  const STORAGE_KEY = 'invoiceGeneratorDraft.v1';

  let invoiceState = {
    items: [],
    discount: { type: 'percent', value: 0 },
    vatRate: 0,
    subtotal: 0,
    discountAmount: 0,
    vatAmount: 0,
    total: 0,
    currencySymbol: '$',
    logoDataUrl: null
  };

  /* ============================================================
     Helpers
     ============================================================ */
  function formatCurrency(amount) {
    const safe = isNaN(amount) ? 0 : amount;
    return invoiceState.currencySymbol + safe.toFixed(2);
  }

  function parseInputNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  function formatToPDFDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: '2-digit' };
    const d = new Date(dateString + 'T00:00:00');
    return isNaN(d) ? dateString : d.toLocaleDateString('en-US', options);
  }

  function getImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function () { resolve({ width: this.width, height: this.height }); };
      img.src = url;
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function showToast(message, type = 'success') {
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${escapeHtml(message)}`;
    toast.className = `toast show ${type}`;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.classList.remove('show'); }, 2600);
  }

  /* ============================================================
     Logo upload
     ============================================================ */
  logoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        invoiceState.logoDataUrl = e.target.result;
        logoPreview.src = e.target.result;
        logoPreview.classList.remove('hidden');
        placeholderIcon.classList.add('hidden');
        updatePreview();
        saveDraft();
      };
      reader.readAsDataURL(file);
    } else {
      invoiceState.logoDataUrl = null;
      logoPreview.src = '';
      logoPreview.classList.add('hidden');
      placeholderIcon.classList.remove('hidden');
      updatePreview();
      saveDraft();
    }
  });

  /* ============================================================
     Currency
     ============================================================ */
  function updateCurrency() {
    const selectedOption = currencySelect.options[currencySelect.selectedIndex];
    currentCurrencyFlag.src = selectedOption.dataset.flag;
    invoiceState.currencySymbol = selectedOption.dataset.symbol;

    if (discountType.value === 'value') {
      discountType.options[1].textContent = invoiceState.currencySymbol;
    }

    updateCalculations();
  }

  currencySelect.addEventListener('change', () => { updateCurrency(); saveDraft(); });

  /* ============================================================
     Calculations
     ============================================================ */
  function updateCalculations() {
    invoiceState.subtotal = 0;
    invoiceState.items = [];
    const itemRows = itemsList.querySelectorAll('.item-row');

    itemRows.forEach(row => {
      const descInput = row.querySelector('.item-description');
      const qtyInput = row.querySelector('.item-qty');
      const rateInput = row.querySelector('.item-rate');
      const amountSpan = row.querySelector('.item-amount');

      const qty = parseInputNumber(qtyInput.value);
      const rate = parseInputNumber(rateInput.value);
      const amount = qty * rate;

      amountSpan.textContent = formatCurrency(amount);
      invoiceState.subtotal += amount;

      invoiceState.items.push({ description: descInput.value, qty, rate, amount });
    });

    invoiceState.discount.type = discountType.value;
    invoiceState.discount.value = parseInputNumber(discountValueInput.value);

    let discountAmount = 0;
    if (invoiceState.discount.type === 'percent') {
      discountAmount = invoiceState.subtotal * (invoiceState.discount.value / 100);
    } else {
      discountAmount = invoiceState.discount.value;
    }
    discountAmount = Math.min(Math.max(discountAmount, 0), invoiceState.subtotal || 0);
    invoiceState.discountAmount = discountAmount;

    const discountedSubtotal = invoiceState.subtotal - discountAmount;
    invoiceState.vatRate = parseInputNumber(vatValueInput.value);
    invoiceState.vatAmount = discountedSubtotal * (invoiceState.vatRate / 100);
    invoiceState.total = discountedSubtotal + invoiceState.vatAmount;

    updateUI();
    updatePreview();
  }

  function updateUI() {
    subtotalDisplay.textContent = formatCurrency(invoiceState.subtotal);
    vatLabel.textContent = `VAT (${invoiceState.vatRate}%)`;
    vatAmountDisplay.textContent = formatCurrency(invoiceState.vatAmount);
    totalDisplay.textContent = formatCurrency(invoiceState.total);
    balanceDueDisplay.textContent = formatCurrency(invoiceState.total);
  }

  /* ============================================================
     Live preview panel
     ============================================================ */
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function updatePreview() {
    const businessName = val('businessName') || 'Your Business Name';
    const businessEmail = val('businessEmail');
    const businessPhone = val('businessPhone');
    const businessAddress = val('businessAddress');
    const metaLines = [businessAddress, businessPhone, businessEmail].filter(Boolean).join('\n');

    document.getElementById('previewBusinessName').textContent = businessName;
    document.getElementById('previewBusinessMeta').textContent = metaLines;

    const previewLogo = document.getElementById('previewLogo');
    if (invoiceState.logoDataUrl) {
      previewLogo.src = invoiceState.logoDataUrl;
      previewLogo.classList.remove('hidden');
    } else {
      previewLogo.classList.add('hidden');
    }

    document.getElementById('previewInvoiceNumber').textContent = '#' + (val('invoiceNumber') || '1');

    document.getElementById('previewBillTo').textContent = val('billTo') || 'Client name';
    document.getElementById('previewBillToAddress').textContent = val('billToAddress');
    document.getElementById('previewBillToEmail').textContent = val('billToEmail');

    document.getElementById('previewInvoiceDate').textContent = formatToPDFDate(val('invoiceDate')) || '—';
    document.getElementById('previewDueDate').textContent = formatToPDFDate(val('dueDate')) || '—';

    const terms = val('paymentTerms');
    document.getElementById('previewTermsRow').style.display = terms ? 'flex' : 'none';
    document.getElementById('previewPaymentTerms').textContent = terms;

    const po = val('poNumber');
    document.getElementById('previewPoRow').style.display = po ? 'flex' : 'none';
    document.getElementById('previewPoNumber').textContent = po;

    // Items
    const body = document.getElementById('previewItemsBody');
    body.innerHTML = '';
    const visibleItems = invoiceState.items.filter(it => it.description || it.qty || it.rate);
    if (visibleItems.length === 0) {
      body.innerHTML = `<tr class="preview-empty-row"><td colspan="4">No items added yet</td></tr>`;
    } else {
      visibleItems.forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="col-desc">${escapeHtml(it.description || 'Untitled item')}</td>
          <td class="col-qty">${it.qty}</td>
          <td class="col-rate">${formatCurrency(it.rate)}</td>
          <td class="col-amount">${formatCurrency(it.amount)}</td>
        `;
        body.appendChild(tr);
      });
    }

    document.getElementById('previewSubtotal').textContent = formatCurrency(invoiceState.subtotal);

    const discountRow = document.getElementById('previewDiscountRow');
    if (invoiceState.discountAmount > 0) {
      discountRow.style.display = 'flex';
      const label = invoiceState.discount.type === 'percent'
        ? `Discount (${invoiceState.discount.value}%)`
        : 'Discount';
      document.getElementById('previewDiscountLabel').textContent = label;
      document.getElementById('previewDiscountAmount').textContent = '-' + formatCurrency(invoiceState.discountAmount);
    } else {
      discountRow.style.display = 'none';
    }

    document.getElementById('previewVatLabel').textContent = `VAT (${invoiceState.vatRate}%)`;
    document.getElementById('previewVatAmount').textContent = formatCurrency(invoiceState.vatAmount);
    document.getElementById('previewTotal').textContent = formatCurrency(invoiceState.total);
    document.getElementById('previewBalanceDue').textContent = formatCurrency(invoiceState.total);

    const notes = val('notes');
    document.getElementById('previewNotesBlock').style.display = notes ? 'block' : 'none';
    document.getElementById('previewNotes').textContent = notes;

    const terms2 = val('terms');
    document.getElementById('previewTermsBlock').style.display = terms2 ? 'block' : 'none';
    document.getElementById('previewTermsText').textContent = terms2;
  }

  /* ============================================================
     Items list
     ============================================================ */
  function bindRow(row) {
    row.querySelector('.item-description').addEventListener('input', () => { updateCalculations(); saveDraft(); });
    row.querySelector('.item-qty').addEventListener('input', () => { updateCalculations(); saveDraft(); });
    row.querySelector('.item-rate').addEventListener('input', () => { updateCalculations(); saveDraft(); });
    row.querySelector('.remove-item-btn').addEventListener('click', function () {
      if (itemsList.querySelectorAll('.item-row').length <= 1) {
        row.querySelector('.item-description').value = '';
        row.querySelector('.item-qty').value = 0;
        row.querySelector('.item-rate').value = 0;
        updateCalculations();
        saveDraft();
        return;
      }
      row.remove();
      updateCalculations();
      saveDraft();
    });
  }

  function addItemRow(data) {
    const newRow = document.createElement('div');
    newRow.className = 'item-row';
    newRow.innerHTML = `
      <input type="text" class="item-description col-desc" placeholder="Description" value="${escapeHtml(data?.description || '')}">
      <input type="number" class="item-qty col-qty" value="${data?.qty ?? 1}" min="0">
      <input type="number" class="item-rate col-rate" value="${data?.rate ?? 0}" min="0" step="0.01">
      <span class="item-amount col-amount">${formatCurrency((data?.qty ?? 1) * (data?.rate ?? 0))}</span>
      <button class="remove-item-btn" title="Remove item"><i class="fas fa-trash-alt"></i></button>
    `;
    bindRow(newRow);
    itemsList.appendChild(newRow);
    updateCalculations();
    return newRow;
  }

  /* ============================================================
     PDF generation (brand-matched)
     ============================================================ */
  async function generatePDF(isDownload = true) {
    try {
      const businessName = val('businessName');
      const businessEmail = val('businessEmail');
      const businessPhone = val('businessPhone');
      const businessAddress = val('businessAddress');
      const invoiceNumber = val('invoiceNumber') || '1';
      const invoiceDateRaw = val('invoiceDate');
      const dueDateRaw = val('dueDate');
      const paymentTerms = val('paymentTerms');
      const poNumber = val('poNumber');
      const billTo = val('billTo');
      const billToAddress = val('billToAddress');
      const billToEmail = val('billToEmail');
      const notes = val('notes');
      const terms = val('terms');

      const ACCENT = '#2362EF';
      const TEXT_PRIMARY = '#09121f';
      const TEXT_SECONDARY = '#5c646f';
      const BORDER = '#e0e5eb';
      const TINT = '#f3f8fd';

      let contentDefinition = [];

      // Header
      let headerColumns = [
        {
          width: '*',
          stack: [
            { text: businessName || 'Your Business Name', style: 'companyName' },
            ...(businessAddress ? [{ text: businessAddress, style: 'meta' }] : []),
            ...(businessPhone ? [{ text: businessPhone, style: 'meta' }] : []),
            ...(businessEmail ? [{ text: businessEmail, style: 'meta' }] : [])
          ]
        },
        {
          width: 'auto',
          stack: [
            { text: 'INVOICE', style: 'mainTitle', alignment: 'right' },
            { text: '#' + invoiceNumber, style: 'subTitle', alignment: 'right' }
          ]
        }
      ];

      if (invoiceState.logoDataUrl) {
        const dimensions = await getImageDimensions(invoiceState.logoDataUrl);
        const scale = 42 / dimensions.height;
        const finalWidth = dimensions.width * scale;
        headerColumns[0].stack.unshift({ image: invoiceState.logoDataUrl, width: finalWidth, height: 42, margin: [0, 0, 0, 10] });
      }

      contentDefinition.push({ columns: headerColumns, margin: [0, 0, 0, 6] });
      contentDefinition.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: BORDER }], margin: [0, 20, 0, 20] });

      // Bill To / Dates row
      const dateStack = [
        { text: 'INVOICE DATE', style: 'sectionLabel' },
        { text: formatToPDFDate(invoiceDateRaw) || '—', margin: [0, 3, 0, 10] },
        { text: 'DUE DATE', style: 'sectionLabel' },
        { text: formatToPDFDate(dueDateRaw) || '—', margin: [0, 3, 0, 0] }
      ];
      if (paymentTerms) dateStack.push({ text: 'TERMS', style: 'sectionLabel', margin: [0, 10, 0, 0] }, { text: paymentTerms, margin: [0, 3, 0, 0] });
      if (poNumber) dateStack.push({ text: 'PO NUMBER', style: 'sectionLabel', margin: [0, 10, 0, 0] }, { text: poNumber, margin: [0, 3, 0, 0] });

      contentDefinition.push({
        columns: [
          {
            width: '55%',
            stack: [
              { text: 'BILL TO', style: 'sectionLabel' },
              { text: billTo || '—', bold: true, margin: [0, 4, 0, 0], fontSize: 12 },
              ...(billToAddress ? [{ text: billToAddress, margin: [0, 3, 0, 0], color: TEXT_SECONDARY }] : []),
              ...(billToEmail ? [{ text: billToEmail, margin: [0, 3, 0, 0], color: TEXT_SECONDARY }] : [])
            ]
          },
          { width: '45%', stack: dateStack, alignment: 'right' }
        ],
        margin: [0, 0, 0, 26]
      });

      // Items table
      let tableBody = [[
        { text: 'DESCRIPTION', style: 'tableHeader' },
        { text: 'QTY', style: 'tableHeader', alignment: 'right' },
        { text: 'RATE', style: 'tableHeader', alignment: 'right' },
        { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
      ]];

      invoiceState.items
        .filter(it => it.description || it.qty || it.rate)
        .forEach(it => {
          tableBody.push([
            { text: it.description || 'Untitled item', margin: [0, 6, 0, 6] },
            { text: String(it.qty), alignment: 'right', margin: [0, 6, 0, 6] },
            { text: formatCurrency(it.rate), alignment: 'right', margin: [0, 6, 0, 6] },
            { text: formatCurrency(it.amount), alignment: 'right', margin: [0, 6, 0, 6] }
          ]);
        });

      contentDefinition.push({
        table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto'], body: tableBody },
        layout: {
          hLineWidth: (i) => (i === 1 ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: () => BORDER,
          fillColor: (i) => (i === 0 ? TINT : null)
        },
        margin: [0, 0, 0, 20]
      });

      // Summary
      const summaryBody = [
        ['Subtotal', { text: formatCurrency(invoiceState.subtotal), alignment: 'right' }]
      ];
      if (invoiceState.discountAmount > 0) {
        const label = invoiceState.discount.type === 'percent' ? `Discount (${invoiceState.discount.value}%)` : 'Discount';
        summaryBody.push([{ text: label, color: TEXT_SECONDARY }, { text: '-' + formatCurrency(invoiceState.discountAmount), alignment: 'right' }]);
      }
      summaryBody.push([{ text: `VAT (${invoiceState.vatRate}%)`, color: TEXT_SECONDARY }, { text: formatCurrency(invoiceState.vatAmount), alignment: 'right' }]);
      summaryBody.push([{ text: 'Total', bold: true, fontSize: 12 }, { text: formatCurrency(invoiceState.total), bold: true, alignment: 'right', fontSize: 12 }]);

      contentDefinition.push({
        columns: [
          { width: '*', text: '' },
          {
            width: '42%',
            table: { widths: ['*', 'auto'], body: summaryBody },
            layout: 'noBorders'
          }
        ],
        margin: [0, 0, 0, 10]
      });

      contentDefinition.push({
        columns: [
          { width: '*', text: '' },
          {
            width: '42%',
            table: {
              widths: ['*', 'auto'],
              body: [[
                { text: 'Balance Due', bold: true, color: ACCENT, fontSize: 12 },
                { text: formatCurrency(invoiceState.total), bold: true, alignment: 'right', color: ACCENT, fontSize: 13 }
              ]]
            },
            layout: 'noBorders',
            fillColor: TINT,
            margin: [0, 4, 0, 0]
          }
        ],
        margin: [0, 0, 0, 30]
      });

      if (notes) {
        contentDefinition.push({ text: 'NOTES', style: 'sectionLabel' });
        contentDefinition.push({ text: notes, margin: [0, 4, 0, 16], color: TEXT_SECONDARY, fontSize: 10.5 });
      }
      if (terms) {
        contentDefinition.push({ text: 'TERMS & CONDITIONS', style: 'sectionLabel' });
        contentDefinition.push({ text: terms, margin: [0, 4, 0, 0], color: TEXT_SECONDARY, fontSize: 10.5 });
      }

      const docDefinition = {
        content: contentDefinition,
        styles: {
          mainTitle: { fontSize: 24, bold: true, color: ACCENT },
          subTitle: { fontSize: 11, color: TEXT_SECONDARY, margin: [0, 4, 0, 0] },
          companyName: { fontSize: 15, bold: true, color: TEXT_PRIMARY },
          meta: { fontSize: 9.5, color: TEXT_SECONDARY, margin: [0, 1, 0, 0] },
          sectionLabel: { fontSize: 9, bold: true, color: TEXT_SECONDARY, characterSpacing: 0.5 },
          tableHeader: { bold: true, fontSize: 9.5, color: TEXT_SECONDARY }
        },
        defaultStyle: { fontSize: 10.5, color: TEXT_PRIMARY }
      };

      if (isDownload) {
        pdfMake.createPdf(docDefinition).download('Invoice-' + invoiceNumber + '.pdf');
        showToast('Invoice downloaded');
      } else {
        pdfMake.createPdf(docDefinition).open();
      }
    } catch (error) {
      console.error('PDF Generation Error: ', error);
      showToast('Something went wrong generating the PDF', 'error');
    }
  }

  /* ============================================================
     Draft autosave (localStorage) — client-side only
     ============================================================ */
  function saveDraft() {
    try {
      const data = {};
      FORM_FIELD_IDS.forEach(id => { data[id] = val(id); });
      data.currency = currencySelect.value;
      data.discountType = discountType.value;
      data.discountValue = discountValueInput.value;
      data.vatValue = vatValueInput.value;
      data.logoDataUrl = invoiceState.logoDataUrl;
      data.items = Array.from(itemsList.querySelectorAll('.item-row')).map(row => ({
        description: row.querySelector('.item-description').value,
        qty: row.querySelector('.item-qty').value,
        rate: row.querySelector('.item-rate').value
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      flashDraftStatus();
    } catch (e) {
      console.warn('Could not save draft', e);
    }
  }

  function flashDraftStatus() {
    const el = document.getElementById('draftStatus');
    if (!el) return;
    el.style.opacity = '1';
    clearTimeout(flashDraftStatus._t);
    flashDraftStatus._t = setTimeout(() => { el.style.opacity = '0.55'; }, 1200);
  }

  function loadDraft() {
    let data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch (e) { return false; }
    if (!data) return false;

    FORM_FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el && data[id] !== undefined) el.value = data[id];
    });

    if (data.currency) currencySelect.value = data.currency;
    if (data.discountType) discountType.value = data.discountType;
    if (data.discountValue !== undefined) discountValueInput.value = data.discountValue;
    if (data.vatValue !== undefined) vatValueInput.value = data.vatValue;

    if (data.logoDataUrl) {
      invoiceState.logoDataUrl = data.logoDataUrl;
      logoPreview.src = data.logoDataUrl;
      logoPreview.classList.remove('hidden');
      placeholderIcon.classList.add('hidden');
    }

    itemsList.innerHTML = '';
    if (Array.isArray(data.items) && data.items.length > 0) {
      data.items.forEach(it => addItemRow(it));
    } else {
      addItemRow({ description: 'Professional dental services', qty: 1, rate: 0 });
    }

    return true;
  }

  function setDefaultDates() {
    const invoiceDateEl = document.getElementById('invoiceDate');
    const dueDateEl = document.getElementById('dueDate');
    if (!invoiceDateEl.value) {
      const today = new Date();
      invoiceDateEl.value = today.toISOString().slice(0, 10);
    }
    if (!dueDateEl.value) {
      const due = new Date();
      due.setDate(due.getDate() + 30);
      dueDateEl.value = due.toISOString().slice(0, 10);
    }
  }

  function resetForm() {
    if (!confirm('Start a new invoice? This clears the current draft.')) return;
    localStorage.removeItem(STORAGE_KEY);
    FORM_FIELD_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('terms').value = 'Payment is due within 30 days of invoice date.';
    document.getElementById('invoiceNumber').value = '1001';
    discountType.value = 'percent';
    discountValueInput.value = 0;
    vatValueInput.value = 0;
    currencySelect.value = 'USD';
    invoiceState.logoDataUrl = null;
    logoPreview.src = '';
    logoPreview.classList.add('hidden');
    placeholderIcon.classList.remove('hidden');
    itemsList.innerHTML = '';
    addItemRow({ description: '', qty: 1, rate: 0 });
    setDefaultDates();
    updateCurrency();
    showToast('Started a new invoice');
  }

  /* ============================================================
     Wire up events
     ============================================================ */
  addItemBtn.addEventListener('click', () => { addItemRow({ description: '', qty: 1, rate: 0 }); saveDraft(); });

  document.querySelectorAll('#discountValue, #vatValue').forEach(input => {
    input.addEventListener('input', () => { updateCalculations(); saveDraft(); });
  });

  discountType.addEventListener('change', function () {
    invoiceState.discount.type = this.value;
    this.options[1].textContent = this.value === 'percent' ? '%' : invoiceState.currencySymbol;
    updateCalculations();
    saveDraft();
  });

  FORM_FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { updatePreview(); saveDraft(); });
  });

  downloadBtn.addEventListener('click', (e) => { e.preventDefault(); generatePDF(true); });
  previewBtn.addEventListener('click', (e) => { e.preventDefault(); generatePDF(false); });
  printBtn.addEventListener('click', (e) => { e.preventDefault(); window.print(); });
  resetBtn.addEventListener('click', (e) => { e.preventDefault(); resetForm(); });

  /* ============================================================
     Init
     ============================================================ */
  const hadDraft = loadDraft();
  if (!hadDraft) {
    addItemRow({ description: 'Professional dental services', qty: 1, rate: 0 });
  }
  setDefaultDates();
  updateCurrency();
  updatePreview();
});
