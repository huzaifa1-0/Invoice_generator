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

    // State object to hold values for calculations
    let invoiceState = {
        items: [],
        discount: { type: 'percent', value: 0 },
        vatRate: 10, // Initial VAT %
        subtotal: 0,
        vatAmount: 0,
        total: 0,
        currencySymbol: '$'
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
            <input type="number" class="item-qty col-qty" value="1">
            <input type="number" class="item-rate col-rate" value="0">
            <span class="item-amount col-amount">$0.00</span>
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

    function generatePDF(isDownload = true) {
        // Collect all data needed for the PDF
        const docDefinition = {
            content: [
                { text: document.getElementById('businessName').value || 'YOUR COMPANY NAME', style: 'header' },
                { text: 'Invoice No: #' + document.getElementById('invoiceNumber').value, style: 'subHeader' },
                { text: 'Invoice Date: ' + document.getElementById('invoiceDate').value, style: 'subHeader' },
                { text: 'Due Date: ' + document.getElementById('dueDate').value, style: 'subHeader' },
                '\n',
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
                '\n',
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 50, 80, 80],
                        body: [
                            // Define table headers
                            [
                                { text: 'Description', style: 'tableHeader' },
                                { text: 'Qty', style: 'tableHeader' },
                                { text: 'Rate', style: 'tableHeader' },
                                { text: 'Amount', style: 'tableHeader' }
                            ]
                        ]
                    }
                },
                '\n\n',
                {
                    columns: [
                        { width: '60%', text: ['Notes:\n', document.getElementById('notes').value] },
                        {
                            width: '40%',
                            table: {
                                widths: ['*', 'auto'],
                                body: [
                                    ['Subtotal:', formatCurrency(invoiceState.subtotal)],
                                    [`VAT (${invoiceState.vatRate}%):`, formatCurrency(invoiceState.vatAmount)],
                                    [{ text: 'Total:', bold: true }, { text: formatCurrency(invoiceState.total), bold: true }]
                                ]
                            },
                            layout: 'noBorders'
                        }
                    ]
                },
                '\n',
                { text: 'Terms & Conditions:', style: 'tableHeader' },
                document.getElementById('terms').value
            ],
            styles: {
                header: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
                subHeader: { fontSize: 12, color: 'gray' },
                tableHeader: { bold: true, fontSize: 13, color: 'black', margin: [0, 0, 0, 5] }
            },
            defaultStyle: { fontSize: 11, color: '#333' }
        };

        // Populate table body from item rows
        const itemRows = itemsList.querySelectorAll('.item-row');
        itemRows.forEach(row => {
            const desc = row.querySelector('.item-description').value;
            const qty = row.querySelector('.item-qty').value;
            const rate = row.querySelector('.item-rate').value;
            const amount = row.querySelector('.item-amount').textContent;

            docDefinition.content[7].table.body.push([desc, qty, rate, amount]);
        });

        // Generate and perform action (download or open)
        if (isDownload) {
            pdfMake.createPdf(docDefinition).download('Invoice_#' + document.getElementById('invoiceNumber').value + '.pdf');
        } else {
            pdfMake.createPdf(docDefinition).open();
        }
    }

    // === Event Listeners ===

    // Initial calculation on load
    updateCalculations();

    // Listen for changes in inputs to trigger recalculation
    document.querySelectorAll('.item-qty, .item-rate, #discountValue, #vatValue').forEach(input => {
        input.addEventListener('input', updateCalculations);
    });

    // Discount type dropdown change
    discountType.addEventListener('change', function() {
        invoiceState.discount.type = this.value;
        updateCalculations();
    });

    // Add Item button
    addItemBtn.addEventListener('click', addItemRow);

    // Initial Remove buttons on page load (if any)
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