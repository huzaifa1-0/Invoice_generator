document.addEventListener('DOMContentLoaded', function() {
    // === Variables & DOM Elements ===
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

    // Logo elements
    const logoInput = document.getElementById('logoInput');
    const logoPreview = document.getElementById('logoPreview');
    const placeholderIcon = document.getElementById('placeholderIcon');

    // Currency elements
    const currencySelect = document.getElementById('currency');
    const currentCurrencyFlag = document.getElementById('currentCurrencyFlag');

    // State object to hold values for calculations. Defaults are set to 0.
    let invoiceState = {
        items: [],
        discount: { type: 'percent', value: 0 },
        vatRate: 0, // Initial VAT % is now 0
        subtotal: 0,
        vatAmount: 0,
        total: 0,
        currencySymbol: '$', // Default to USD first
        logoDataUrl: null // Store image as data URL for PDF
    };

    // === Helper Functions ===

    // Formats a number to currency with symbol
    function formatCurrency(amount) {
        return invoiceState.currencySymbol + amount.toFixed(2);
    }

    // Parses a number from input safely
    function parseInputNumber(value) {
        let num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }

    // Helper to get image width/height for PDF
    function getImageDimensions(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                resolve({ width: this.width, height: this.height });
            };
            img.src = url;
        });
    }

    // === Logo Management ===

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

    // === Currency Management ===

    function updateCurrency() {
        const selectedOption = currencySelect.options[currencySelect.selectedIndex];
        currentCurrencyFlag.src = selectedOption.dataset.flag;
        invoiceState.currencySymbol = selectedOption.dataset.symbol;

        // Update value option symbol for fixed discount
        if (discountType.value === 'value') {
            discountType.options[1].textContent = invoiceState.currencySymbol;
        }

        updateCalculations();
    }

    currencySelect.addEventListener('change', updateCurrency);

    // Initial update
    updateCurrency();

    // === Core Logic: Calculations ===

    function updateCalculations() {
        // 1. Calculate items total and individual amounts
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

        // 2. Calculate Discount
        invoiceState.discount.type = discountType.value;
        invoiceState.discount.value = parseInputNumber(discountValueInput.value);

        let discountAmount = 0;
        if (invoiceState.discount.type === 'percent') {
            discountAmount = (invoiceState.subtotal * (invoiceState.discount.value / 100));
        } else {
            discountAmount = invoiceState.discount.value;
        }

        const discountedSubtotal = invoiceState.subtotal - discountAmount;

        // 3. Calculate VAT
        invoiceState.vatRate = parseInputNumber(vatValueInput.value);
        invoiceState.vatAmount = (discountedSubtotal * (invoiceState.vatRate / 100));

        // 4. Calculate Final Total
        invoiceState.total = discountedSubtotal + invoiceState.vatAmount;

        // 5. Update UI
        updateUI();
    }

    function updateUI() {
        subtotalDisplay.textContent = formatCurrency(invoiceState.subtotal);
        vatLabel.textContent = `VAT (${invoiceState.vatRate}%)`;
        vatAmountDisplay.textContent = formatCurrency(invoiceState.vatAmount);
        totalDisplay.textContent = formatCurrency(invoiceState.total);
        balanceDueDisplay.textContent = formatCurrency(invoiceState.total);
    }

    // === UI Interaction Functions ===

    // Adds a new item row to the table
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

        // Add event listeners to the new inputs for calculations
        newRow.querySelector('.item-qty').addEventListener('input', updateCalculations);
        newRow.querySelector('.item-rate').addEventListener('input', updateCalculations);

        // Add event listener to the remove button
        newRow.querySelector('.remove-item-btn').addEventListener('click', function() {
            this.closest('.item-row').remove();
            updateCalculations();
        });

        itemsList.appendChild(newRow);
        updateCalculations();
    }

    // === PDF Generation Logic (using pdfmake) ===

    async function generatePDF(isDownload = true) {
        const businessName = document.getElementById('businessName').value || 'YOUR COMPANY NAME';
        const invoiceNumber = document.getElementById('invoiceNumber').value;
        const invoiceDate = document.getElementById('invoiceDate').value;
        const dueDate = document.getElementById('dueDate').value;

        // Definition structure for content
        let contentDefinition = [];

        // 1. Logo (if present) and Company Name
        if (invoiceState.logoDataUrl) {
            // Calculate dimensions for good scaling
            const dimensions = await getImageDimensions(invoiceState.logoDataUrl);
            const scale = 50 / dimensions.height; // scale down to height of 50
            const finalWidth = dimensions.width * scale;

            contentDefinition.push({
                columns: [
                    { image: invoiceState.logoDataUrl, width: finalWidth, height: 50 },
                    { text: businessName, style: 'header', margin: [20, 10, 0, 0] }
                ],
                margin: [0, 0, 0, 20]
            });
        } else {
            contentDefinition.push({ text: businessName, style: 'header' });
        }

        // 2. Invoice Details Header
        contentDefinition.push(
            { text: 'Invoice No: #' + invoiceNumber, style: 'subHeader' },
            { text: 'Invoice Date: ' + invoiceDate, style: 'subHeader' },
            { text: 'Due Date: ' + dueDate, style: 'subHeader' },
            '\n'
        );

        // 3. Billing columns
        contentDefinition.push(
            {
                columns: [
                    {
                        width: '50%',
                        text: [
                            {text: 'Bill To (Client):\n', style: 'tableHeader'},
                            document.getElementById('billTo').value || 'Client Name\n',
                            document.getElementById('billToAddress').value || 'Client Address'
                        ]
                    },
                    {
                        width: '50%',
                        text: [
                            {text: 'Ship To:\n', style: 'tableHeader'},
                            document.getElementById('shipTo').value || 'N/A'
                        ]
                    }
                ]
            },
            '\n'
        );

        // 4. Item table headers
        let tableBody = [
            [
                { text: 'Description', style: 'tableHeader' },
                { text: 'Qty', style: 'tableHeader', alignment: 'right' },
                { text: 'Rate', style: 'tableHeader', alignment: 'right' },
                { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ]
        ];

        // 5. Populate table body from item rows
        const itemRows = itemsList.querySelectorAll('.item-row');
        itemRows.forEach(row => {
            const desc = row.querySelector('.item-description').value;
            const qty = row.querySelector('.item-qty').value;
            const rate = formatCurrency(parseInputNumber(row.querySelector('.item-rate').value));
            const amount = row.querySelector('.item-amount').textContent;

            tableBody.push([desc, {text:qty, alignment:'right'}, {text:rate, alignment:'right'}, {text:amount, alignment:'right'}]);
        });

        // Add table definition
        contentDefinition.push(
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 50, 80, 80],
                    body: tableBody
                }
            },
            '\n\n'
        );

        // 6. Summary and Notes
        contentDefinition.push(
            {
                columns: [
                    { width: '60%', text: ['Notes:\n', document.getElementById('notes').value] },
                    {
                        width: '40%',
                        table: {
                            widths: ['*', 'auto'],
                            body: [
                                ['Subtotal:', {text: formatCurrency(invoiceState.subtotal), alignment:'right'}],
                                [`VAT (${invoiceState.vatRate}%):`, {text: formatCurrency(invoiceState.vatAmount), alignment:'right'}],
                                [{ text: 'Total:', bold: true }, { text: formatCurrency(invoiceState.total), bold: true, alignment:'right' }]
                            ]
                        },
                        layout: 'noBorders'
                    }
                ]
            },
            '\n'
        );

        // 7. Terms & Conditions
        contentDefinition.push(
            { text: 'Terms & Conditions:', style: 'tableHeader' },
            document.getElementById('terms').value
        );

        // Definining the whole doc
        const docDefinition = {
            content: contentDefinition,
            styles: {
                header: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
                subHeader: { fontSize: 12, color: 'gray' },
                tableHeader: { bold: true, fontSize: 13, color: 'black', margin: [0, 0, 0, 5] }
            },
            defaultStyle: { fontSize: 11, color: '#333' }
        };

        // Generate and perform action (download or open)
        if (isDownload) {
            pdfMake.createPdf(docDefinition).download('Invoice_#' + invoiceNumber + '.pdf');
        } else {
            pdfMake.createPdf(docDefinition).open();
        }
    }

    // === Event Listeners ===

    // Initial calculation on load (after currency)
    updateCalculations();

    // Listen for changes in inputs to trigger recalculation
    document.querySelectorAll('.item-qty, .item-rate, #discountValue, #vatValue').forEach(input => {
        input.addEventListener('input', updateCalculations);
    });

    // Discount type dropdown change
    discountType.addEventListener('change', function() {
        invoiceState.discount.type = this.value;
        // Update symbol label
        if (this.value === 'percent') {
            this.options[1].textContent = '%';
        } else {
            this.options[1].textContent = invoiceState.currencySymbol;
        }
        updateCalculations();
    });

    // Add Item button
    addItemBtn.addEventListener('click', addItemRow);

    // Initial Remove buttons on page load
    itemsList.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.item-row').remove();
            updateCalculations();
        });
    });

    // Download button
    downloadBtn.addEventListener('click', () => generatePDF(true));

    // Preview button
    previewBtn.addEventListener('click', () => generatePDF(false));

});