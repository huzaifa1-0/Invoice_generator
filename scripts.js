document.addEventListener('DOMContentLoaded', function() {
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

    const logoInput = document.getElementById('logoInput');
    const logoPreview = document.getElementById('logoPreview');
    const placeholderIcon = document.getElementById('placeholderIcon');
    const currencySelect = document.getElementById('currency');
    const currentCurrencyFlag = document.getElementById('currentCurrencyFlag');

    let invoiceState = {
        items: [],
        discount: { type: 'percent', value: 0 },
        vatRate: 0,
        subtotal: 0,
        vatAmount: 0,
        total: 0,
        currencySymbol: '$',
        logoDataUrl: null
    };

    function formatCurrency(amount) {
        return invoiceState.currencySymbol + amount.toFixed(2);
    }

    function parseInputNumber(value) {
        let num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }
    
    // Formats dates from "2026-03-04" to "Mar 04, 2026"
    function formatToPDFDate(dateString) {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'short', day: '2-digit' };
        const d = new Date(dateString);
        return isNaN(d) ? dateString : d.toLocaleDateString('en-US', options);
    }

    function getImageDimensions(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                resolve({ width: this.width, height: this.height });
            };
            img.src = url;
        });
    }

    logoInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                invoiceState.logoDataUrl = e.target.result;
                logoPreview.src = e.target.result;
                logoPreview.classList.remove('hidden');
                placeholderIcon.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            invoiceState.logoDataUrl = null;
            logoPreview.src = '';
            logoPreview.classList.add('hidden');
            placeholderIcon.classList.remove('hidden');
        }
    });

    function updateCurrency() {
        const selectedOption = currencySelect.options[currencySelect.selectedIndex];
        currentCurrencyFlag.src = selectedOption.dataset.flag;
        invoiceState.currencySymbol = selectedOption.dataset.symbol;

        if (discountType.value === 'value') {
            discountType.options[1].textContent = invoiceState.currencySymbol;
        }

        updateCalculations();
    }

    currencySelect.addEventListener('change', updateCurrency);
    updateCurrency();

    function updateCalculations() {
        invoiceState.subtotal = 0;
        const itemRows = itemsList.querySelectorAll('.item-row');

        itemRows.forEach(row => {
            const qtyInput = row.querySelector('.item-qty');
            const rateInput = row.querySelector('.item-rate');
            const amountSpan = row.querySelector('.item-amount');

            const qty = parseInputNumber(qtyInput.value);
            const rate = parseInputNumber(rateInput.value);
            const amount = qty * rate;

            amountSpan.textContent = formatCurrency(amount);
            invoiceState.subtotal += amount;
        });

        invoiceState.discount.type = discountType.value;
        invoiceState.discount.value = parseInputNumber(discountValueInput.value);

        let discountAmount = 0;
        if (invoiceState.discount.type === 'percent') {
            discountAmount = (invoiceState.subtotal * (invoiceState.discount.value / 100));
        } else {
            discountAmount = invoiceState.discount.value;
        }

        const discountedSubtotal = invoiceState.subtotal - discountAmount;
        invoiceState.vatRate = parseInputNumber(vatValueInput.value);
        invoiceState.vatAmount = (discountedSubtotal * (invoiceState.vatRate / 100));
        invoiceState.total = discountedSubtotal + invoiceState.vatAmount;

        updateUI();
    }

    function updateUI() {
        subtotalDisplay.textContent = formatCurrency(invoiceState.subtotal);
        vatLabel.textContent = `VAT (${invoiceState.vatRate}%)`;
        vatAmountDisplay.textContent = formatCurrency(invoiceState.vatAmount);
        totalDisplay.textContent = formatCurrency(invoiceState.total);
        balanceDueDisplay.textContent = formatCurrency(invoiceState.total);
    }

    function addItemRow() {
        const newRow = document.createElement('div');
        newRow.className = 'item-row';
        newRow.innerHTML = `
            <input type="text" class="item-description col-desc" placeholder="Description">
            <input type="number" class="item-qty col-qty" value="0">
            <input type="number" class="item-rate col-rate" value="0">
            <span class="item-amount col-amount">${formatCurrency(0)}</span>
            <button class="remove-item-btn"><i class="fas fa-trash-alt"></i></button>
        `;

        newRow.querySelector('.item-qty').addEventListener('input', updateCalculations);
        newRow.querySelector('.item-rate').addEventListener('input', updateCalculations);
        newRow.querySelector('.remove-item-btn').addEventListener('click', function() {
            this.closest('.item-row').remove();
            updateCalculations();
        });

        itemsList.appendChild(newRow);
        updateCalculations();
    }

    // Completely rewritten PDF function matching your requested style
    async function generatePDF(isDownload = true) {
        try {
            const businessName = document.getElementById('businessName').value || '';
            const invoiceNumber = document.getElementById('invoiceNumber').value || '1';
            const invoiceDateRaw = document.getElementById('invoiceDate').value;
            const dueDateRaw = document.getElementById('dueDate').value;
            const paymentTerms = document.getElementById('paymentTerms').value || 'Net 30';
            const billTo = document.getElementById('billTo').value || '';
            const billToAddress = document.getElementById('billToAddress').value || '';
            
            // Safely fetch Ship To, since it previously crashed here
            const shipToElem = document.getElementById('shipTo');
            const shipTo = shipToElem ? shipToElem.value : '';

            let contentDefinition = [];

            // 1. Header (Logo/From and Invoice info)
            let headerColumns = [
                {
                    width: '*',
                    stack: [
                        { text: 'FROM', style: 'sectionLabel' },
                        { text: businessName, style: 'companyName' }
                    ]
                },
                {
                    width: 'auto',
                    stack: [
                        { text: 'Invoice', style: 'mainTitle', alignment: 'right' },
                        { text: 'INV-' + invoiceNumber, style: 'subTitle', alignment: 'right' }
                    ]
                }
            ];

            if (invoiceState.logoDataUrl) {
                const dimensions = await getImageDimensions(invoiceState.logoDataUrl);
                const scale = 50 / dimensions.height;
                const finalWidth = dimensions.width * scale;
                headerColumns[0].stack.unshift({ image: invoiceState.logoDataUrl, width: finalWidth, height: 50, margin: [0, 0, 0, 10] });
            }

            contentDefinition.push({ columns: headerColumns, margin: [0, 0, 0, 30] });

            // 2. Billing details row
            contentDefinition.push({
                columns: [
                    {
                        width: '50%',
                        stack: [
                            { text: 'BILL TO (CLIENT)', style: 'sectionLabel' },
                            { text: billTo, bold: true, margin: [0, 5, 0, 0] },
                            { text: billToAddress }
                        ]
                    },
                    {
                        width: '50%',
                        stack: [
                            { text: 'SHIP TO', style: 'sectionLabel' },
                            { text: shipTo, margin: [0, 5, 0, 0] }
                        ]
                    }
                ],
                margin: [0, 0, 0, 30]
            });

            // 3. Dates and Terms row
            contentDefinition.push({
                columns: [
                    { width: '*', stack: [{ text: 'PAYMENT TERMS (OPTIONAL)', style: 'sectionLabel' }, { text: paymentTerms, margin: [0, 5, 0, 0] }] },
                    { width: '*', stack: [{ text: 'INVOICE DATE', style: 'sectionLabel' }, { text: formatToPDFDate(invoiceDateRaw), margin: [0, 5, 0, 0] }] },
                    { width: '*', stack: [{ text: 'DUE DATE', style: 'sectionLabel' }, { text: formatToPDFDate(dueDateRaw), margin: [0, 5, 0, 0] }] }
                ],
                margin: [0, 0, 0, 30]
            });

            // 4. Items table
            let tableBody = [
                [
                    { text: 'DESCRIPTION', style: 'tableHeader' },
                    { text: 'QTY', style: 'tableHeader', alignment: 'right' },
                    { text: 'RATE', style: 'tableHeader', alignment: 'right' },
                    { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
                ]
            ];

            const itemRows = itemsList.querySelectorAll('.item-row');
            itemRows.forEach(row => {
                const desc = row.querySelector('.item-description').value;
                const qty = row.querySelector('.item-qty').value;
                const rate = formatCurrency(parseInputNumber(row.querySelector('.item-rate').value));
                const amount = row.querySelector('.item-amount').textContent;

                tableBody.push([
                    { text: desc, margin: [0, 5, 0, 5] }, 
                    { text: qty, alignment: 'right', margin: [0, 5, 0, 5] }, 
                    { text: rate, alignment: 'right', margin: [0, 5, 0, 5] }, 
                    { text: amount, alignment: 'right', margin: [0, 5, 0, 5] }
                ]);
            });

            contentDefinition.push({
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto'],
                    body: tableBody
                },
                layout: 'lightHorizontalLines', // Gives standard invoice lines underneath
                margin: [0, 0, 0, 20]
            });

            // 5. Summary Section (Right Aligned)
            contentDefinition.push({
                columns: [
                    { width: '*', text: '' }, // empty left side
                    {
                        width: '40%',
                        table: {
                            widths: ['*', 'auto'],
                            body: [
                                ['Subtotal', { text: formatCurrency(invoiceState.subtotal), alignment: 'right' }],
                                [{ text: 'Tax\nVAT (' + invoiceState.vatRate + '%)', color: '#555' }, { text: formatCurrency(invoiceState.vatAmount), alignment: 'right' }],
                                [{ text: 'Total', bold: true }, { text: formatCurrency(invoiceState.total), bold: true, alignment: 'right' }],
                                [{ text: 'Balance Due', bold: true, margin: [0, 10, 0, 0] }, { text: formatCurrency(invoiceState.total), bold: true, alignment: 'right', margin: [0, 10, 0, 0] }]
                            ]
                        },
                        layout: 'noBorders'
                    }
                ],
                margin: [0, 0, 0, 30]
            });

            const docDefinition = {
                content: contentDefinition,
                styles: {
                    mainTitle: { fontSize: 28, color: '#333333' },
                    subTitle: { fontSize: 12, color: '#666666', margin: [0, 5, 0, 0] },
                    companyName: { fontSize: 14, bold: true, color: '#333333', margin: [0, 5, 0, 0] },
                    sectionLabel: { fontSize: 10, bold: true, color: '#888888' },
                    tableHeader: { bold: true, fontSize: 11, color: '#555555', fillColor: '#f8f9fa', margin: [0, 5, 0, 5] }
                },
                defaultStyle: { fontSize: 11, color: '#222222' }
            };

            if (isDownload) {
                pdfMake.createPdf(docDefinition).download('INV-' + invoiceNumber + '.pdf');
            } else {
                pdfMake.createPdf(docDefinition).open();
            }
            
        } catch (error) {
            console.error("PDF Generation Error: ", error);
            alert("An error occurred. Check the console for details.");
        }
    }

    updateCalculations();

    document.querySelectorAll('.item-qty, .item-rate, #discountValue, #vatValue').forEach(input => {
        input.addEventListener('input', updateCalculations);
    });

    discountType.addEventListener('change', function() {
        invoiceState.discount.type = this.value;
        if (this.value === 'percent') {
            this.options[1].textContent = '%';
        } else {
            this.options[1].textContent = invoiceState.currencySymbol;
        }
        updateCalculations();
    });

    addItemBtn.addEventListener('click', addItemRow);

    itemsList.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.item-row').remove();
            updateCalculations();
        });
    });

    // Make sure we stop default form submissions and call the updated function safely
    downloadBtn.addEventListener('click', (e) => { e.preventDefault(); generatePDF(true); });
    previewBtn.addEventListener('click', (e) => { e.preventDefault(); generatePDF(false); });

});