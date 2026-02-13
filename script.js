// Tab Navigation
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');

        // Remove active class from all buttons and contents
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Add active class to clicked button and corresponding content
        btn.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    });
});

// Privacy Toggle
const privacyToggle = document.getElementById('privacyToggle');

privacyToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.body.classList.add('privacy-off');
    } else {
        document.body.classList.remove('privacy-off');
    }
});

// Update last modified date
document.getElementById('lastUpdated').textContent = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
});

// Auto-save functionality (localStorage)
function saveData() {
    const data = {
        lastTab: document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'dashboard',
        privacyMode: privacyToggle.checked
    };
    localStorage.setItem('telosData', JSON.stringify(data));
}

function loadData() {
    const savedData = localStorage.getItem('telosData');
    if (savedData) {
        const data = JSON.parse(savedData);

        // Restore tab
        if (data.lastTab) {
            tabBtns.forEach(btn => {
                if (btn.getAttribute('data-tab') === data.lastTab) {
                    btn.click();
                }
            });
        }

        // Restore privacy mode
        if (data.privacyMode) {
            privacyToggle.checked = true;
            document.body.classList.add('privacy-off');
        }
    }
}

// Save on tab change and privacy toggle
tabBtns.forEach(btn => btn.addEventListener('click', saveData));
privacyToggle.addEventListener('change', saveData);

// Load saved data on page load
loadData();
