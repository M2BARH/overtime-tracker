let conversionRate = 1.5;
let barChartInstance = null;
let pieChartInstance = null;
let currentEditId = null;

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            contents.forEach(item => item.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('editModal').style.display = 'none';
    });
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('filterBtn').addEventListener('click', applyHistoryFilter);
    document.getElementById('resetFilterBtn').addEventListener('click', resetHistoryFilter);
});

async function saveSettings() {
    const rateInput = document.getElementById('conversionRate');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const newRate = parseFloat(rateInput.value);

    if (isNaN(newRate) || newRate < 1) {
        showAlertModal("Please enter a valid conversion rate (e.g., 1.5).");
        return;
    }

    await chrome.storage.local.set({ conversionRate: newRate });
    conversionRate = newRate; // Update global variable

    saveBtn.textContent = "Saved! ✔️";
    setTimeout(() => {
        saveBtn.textContent = "Save Settings";
    }, 1500);
}

async function loadSettings() {
    const result = await chrome.storage.local.get({ conversionRate: 1.5 });
    conversionRate = result.conversionRate;
    document.getElementById('conversionRate').value = conversionRate;
}

function calculateHours(start, end) {
    const diffMs = new Date(end) - new Date(start);
    return diffMs / (1000 * 60 * 60); // Convert milliseconds to hours
}

function showAlertModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('alertModal');
        const messageP = document.getElementById('alertMessage');
        const okBtn = document.getElementById('alertOkBtn');

        messageP.textContent = message;
        modal.style.display = 'flex';

        const close = () => {
            modal.style.display = 'none';
            resolve();
        };

        okBtn.addEventListener('click', close, { once: true });
    });
}

document.getElementById("saveBtn").addEventListener("click", async () => {
    const startInput = document.getElementById("startTime");
    const endInput = document.getElementById("endTime");
    const notesInput = document.getElementById("notes");
    const saveButton = document.getElementById("saveBtn");

    const start = startInput.value;
    const end = endInput.value;
    const notes = notesInput.value;

    if (!start || !end || new Date(end) <= new Date(start)) {
        await  showAlertModal("Invalid time range.");
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const rawHours = calculateHours(start, end);
        const convertedHours = rawHours * conversionRate;
        const date = new Date(start).toISOString().split('T')[0];

        await saveEntry({ date, start, end, rawHours, convertedHours, notes });
        await loadHistory();

        startInput.value = "";
        endInput.value = "";
        notesInput.value = "";
        saveButton.textContent = "Saved! ✔️";

    } catch (error) {
        console.error("Failed to save entry:", error);
        await showAlertModal("There was an error saving your entry.");
        saveButton.textContent = "Save Entry";
    } finally {
        setTimeout(() => {
            saveButton.disabled = false;
            saveButton.textContent = "Save Entry";
        }, 2000);
    }
});

function groupByMonth(entries) {
    const grouped = {};
    entries.forEach(entry => {
        const month = new Date(entry.date)
            .toLocaleDateString('default', { month: 'short', year: 'numeric' });
        if (!grouped[month]) {
            grouped[month] = [];
        }
        grouped[month].push(entry);
    });
    return grouped;
}

function renderDashboard(entries) {
    if (barChartInstance) {
        barChartInstance.destroy();
    }
    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    const dailyTotals = {};
    let rawTotal = 0, convertedTotal = 0;

    entries.forEach(entry => {
        const day = new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        dailyTotals[day] = (dailyTotals[day] || 0) + entry.rawHours;
        rawTotal += entry.rawHours;
        convertedTotal += entry.convertedHours;
    });

    barChartInstance = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(dailyTotals),
            datasets: [{
                label: 'Daily Overtime Hours',
                data: Object.values(dailyTotals),
                backgroundColor: 'rgba(75, 192, 192, 0.6)'
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    pieChartInstance = new Chart(document.getElementById('pieChart'), {
        type: 'pie',
        data: {
            labels: ['Raw Hours', 'Converted Business Hours'],
            datasets: [{
                data: [rawTotal, convertedTotal],
                backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)']
            }]
        }
    });
}

function showConfirmationModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const messageP = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        messageP.textContent = message;
        modal.style.display = 'flex';

        const close = (confirmed) => {
            modal.style.display = 'none';
            resolve(confirmed);
        };

        // Use { once: true } to automatically remove listeners after they fire once
        confirmBtn.addEventListener('click', () => close(true), { once: true });
        cancelBtn.addEventListener('click', () => close(false), { once: true });
    });
}

async function loadHistory(startDate, endDate) {
    const allEntries = await  getAllEntries();
    let entries = allEntries || [];

    if (!startDate || !endDate) {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = firstDayOfMonth.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
    }

    document.getElementById('filterStartDate').value = startDate;
    document.getElementById('filterEndDate').value = endDate;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (allEntries && allEntries.length > 0) {
        entries = allEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= start && entryDate <= end;
        });
    }

    if (entries && entries.length > 0) {
        renderDashboard(entries);
    } else {
        if (barChartInstance) barChartInstance.destroy();
        if (pieChartInstance) pieChartInstance.destroy();
    }

    const grouped = groupByMonth(entries);
    const historyList = document.getElementById("history-list");
    const summary = document.getElementById("summary");

    historyList.innerHTML = "";
    let totalRaw = 0, totalConverted = 0;

    for (const month in grouped) {
        const monthEntries = grouped[month];
        const monthTotalRaw = monthEntries.reduce((sum, e) => sum + e.rawHours, 0);
        const monthTotalConverted = monthEntries.reduce((sum, e) => sum + e.convertedHours, 0);

        const monthSection = document.createElement('li');
        monthSection.classList.add('history-month');

        const monthHeader = document.createElement('div');
        monthHeader.classList.add('month-header');
        monthHeader.innerHTML = `<h3>${month}</h3><p>${monthTotalRaw.toFixed(2)}h → ${monthTotalConverted.toFixed(2)}h</p>`;
        monthSection.appendChild(monthHeader);

        const entryList = document.createElement('ul');
        entryList.classList.add('entry-list');
        monthEntries.forEach(entry => {
            const item = document.createElement("li");
            item.classList.add('history-entry');

            const textContent = document.createElement('div');
            textContent.classList.add('entry-text');
            textContent.innerHTML = `
                <span class="entry-date">${new Date(entry.date).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})}</span>
                <span class="entry-hours">${entry.rawHours.toFixed(2)}h → ${entry.convertedHours.toFixed(2)}h</span>
                <span class="entry-notes">${entry.notes}</span>
            `;

            const buttons = document.createElement('div');
            buttons.classList.add('entry-buttons');

            const editButton = document.createElement("button");
            editButton.textContent = "Edit";
            editButton.classList.add('btn-edit');
            editButton.onclick = () => openEditModal(entry);

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.classList.add('btn-danger');
            deleteButton.onclick = async () => {
                const message = "Are you sure you want to delete this entry? This action cannot be undone.";
                const confirmed = await showConfirmationModal(message);
                if (confirmed) {
                    deleteEntry(entry.id);
                }
            };

            buttons.appendChild(editButton);
            buttons.appendChild(deleteButton);

            item.appendChild(textContent);
            item.appendChild(buttons);
            entryList.appendChild(item);
        });

        monthSection.appendChild(entryList);
        historyList.appendChild(monthSection);

        totalRaw += monthTotalRaw;
        totalConverted += monthTotalConverted;
    }

    summary.textContent = `Total Overtime: ${totalRaw.toFixed(2)}h | Total Business Time: ${totalConverted.toFixed(2)}h`;
}

function applyHistoryFilter() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    if (!startDate || !endDate) {
        showAlertModal("Please select both a start and end date.");
        return;
    }
    loadHistory(startDate, endDate);
}

function resetHistoryFilter() {
    loadHistory();
}

function openEditModal(entry) {
    currentEditId = entry.id;
    document.getElementById("editStartTime").value = entry.start;
    document.getElementById("editEndTime").value = entry.end;
    document.getElementById("editNotes").value = entry.notes;
    document.getElementById("editModal").style.display = "block";
}

document.getElementById("cancelBtn").addEventListener("click", () => {
    document.getElementById("editModal").style.display = "none";
});

document.getElementById("updateBtn").addEventListener("click", async () => {
    const start = document.getElementById("editStartTime").value;
    const end = document.getElementById("editEndTime").value;
    const notes = document.getElementById("editNotes").value;
    const updateButton = document.getElementById("updateBtn");

    if (!start || !end || new Date(end) <= new Date(start)) {
        await showAlertModal("Invalid time range.");
        return;
    }

    updateButton.disabled = true;
    updateButton.textContent = "Updating...";

    const rawHours = calculateHours(start, end);
    const convertedHours = rawHours * conversionRate;
    const date = new Date(start).toISOString().split('T')[0];

    await updateEntry(currentEditId, { date, start, end, rawHours, convertedHours, notes });

    updateButton.textContent = "Updated! ✔️";

    setTimeout(() => {
        document.getElementById("editModal").style.display = "none";
        updateButton.disabled = false;
        updateButton.textContent = "Update";
    }, 1000);
});

document.getElementById("exportBtn").addEventListener("click", async () => {
    const allEntries = await getAllEntries();

    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filteredEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= start && entryDate <= end;
    });

    if (filteredEntries.length === 0) {
        await showAlertModal("No entries found in the selected date range to export.");
        return;
    }

    const csv = [
        ["Date", "Start Time", "End Time", "Raw Hours", "Converted Hours", "Notes"],
        ...filteredEntries.map(e => [e.date, e.start, e.end, e.rawHours.toFixed(2), e.convertedHours.toFixed(2), `"${e.notes}"`])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "overtime_history.csv";
    a.click();
    URL.revokeObjectURL(url);
});

async function initializeApp() {
    await loadSettings();
    await loadHistory();
}

initializeApp();
