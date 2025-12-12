function initMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('active'));
        });
    } else {
        console.error('Hamburger or nav-links not found');
    }
}

function showNotification(message) {
    const notifications = document.getElementById('notifications');
    if (!notifications) return;
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = message;
    notifications.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

let destinationsData = [];

function loadSocialMedia() {
    fetch('/api/social-media')
        .then(response => {
            if (!response.ok) throw new Error('Social media fetch failed');
            return response.json();
        })
        .then(data => {
            const twitterImg = document.getElementById('twitter-logo-img');
            const facebookImg = document.getElementById('facebook-logo-img');
            const instagramImg = document.getElementById('instagram-logo-img');
            if (twitterImg && data.twitter?.logo) {
                twitterImg.src = data.twitter.logo;
                twitterImg.parentElement.href = data.twitter.url || '#';
            }
            if (facebookImg && data.facebook?.logo) {
                facebookImg.src = data.facebook.logo;
                facebookImg.parentElement.href = data.facebook.url || '#';
            }
            if (instagramImg && data.instagram?.logo) {
                instagramImg.src = data.instagram.logo;
                instagramImg.parentElement.href = data.instagram.url || '#';
            }
        })
        .catch(error => {
            console.error('Error loading social media:', error);
            const twitterImg = document.getElementById('twitter-logo-img');
            if (twitterImg) twitterImg.src = 'images/default-twitter.png';
            const facebookImg = document.getElementById('facebook-logo-img');
            if (facebookImg) facebookImg.src = 'images/default-facebook.png';
            const instagramImg = document.getElementById('instagram-logo-img');
            if (instagramImg) instagramImg.src = 'images/default-instagram.png';
        });
}

let updateInterval;
let lastDepositTimestamp = localStorage.getItem('lastDepositTimestamp') || null;

function loadUserData(username) {
    if (updateInterval) clearInterval(updateInterval);

    function checkForDepositUpdates() {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Please log in to access your dashboard.');
            window.location.href = 'login.html';
            return;
        }

        fetch(`/api/user/${username}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Session expired or unauthorized');
                }
                throw new Error('User data fetch failed');
            }
            return response.json();
        })
        .then(user => {
            console.log('User data:', user);
            if (!user.personalInfo) console.warn('personalInfo missing');
            const userName = document.getElementById('user-name');
            if (userName) userName.textContent = user.name || 'User';

            const userPic = document.getElementById('user-pic');
            if (userPic) userPic.src = user.profilePic || 'images/default-pic.jpg';

            const userBalance = document.getElementById('user-balance');
            if (userBalance) userBalance.textContent = (user.balance || 0).toFixed(2);

            const userBonus = document.getElementById('user-bonus');
            if (userBonus) userBonus.textContent = (user.bonus || 0).toFixed(2);

            const userDeposits = document.getElementById('user-deposits');
            if (userDeposits) userDeposits.textContent = (user.deposits || 0).toFixed(2);

            const pendingDeposits = document.getElementById('pending-deposits');
            if (pendingDeposits) pendingDeposits.textContent = (user.pendingDeposits || []).reduce((sum, dep) => sum + (dep.amount || 0), 0).toFixed(2);

            const userEmail = document.getElementById('user-email');
            if (userEmail) userEmail.textContent = user.personalInfo?.email || 'Not set';

            const userPhone = document.getElementById('user-phone');
            if (userPhone) userPhone.textContent = user.personalInfo?.phone || 'Not set';

            const userAddress = document.getElementById('user-address');
            if (userAddress) userAddress.textContent = user.personalInfo?.address || 'Not set';

            const pendingVacations = document.getElementById('pending-vacations');
            if (pendingVacations) {
                pendingVacations.innerHTML = '';
                (user.pendingVacations || []).forEach(vacation => {
                    if (!vacation || typeof vacation !== 'object') {
                        console.warn('Invalid vacation object:', vacation);
                        return;
                    }
                    const cost = typeof vacation.cost === 'number' ? vacation.cost.toFixed(2) : 'N/A';
                    const li = document.createElement('li');
                    li.textContent = `${vacation.name || 'Unknown'} ($${cost} - Requested: ${vacation.date || 'N/A'}) - Pending Approval`;
                    pendingVacations.appendChild(li);
                });
            }

            const upcomingVacations = document.getElementById('upcoming-vacations');
            if (upcomingVacations) {
                upcomingVacations.innerHTML = '';
                (user.upcomingVacations || []).forEach(vacation => {
                    const li = document.createElement('li');
                    const cost = typeof vacation.cost === 'number' ? vacation.cost.toFixed(2) : 'N/A';
                    li.textContent = `${vacation.name || 'Unknown'} ($${cost} - Scheduled: ${vacation.date || 'N/A'})`;
                    upcomingVacations.appendChild(li);
                });
                const progressBarFill = document.querySelector('.progress-bar-fill');
                if (progressBarFill) {
                    const progress = (user.upcomingVacations?.length || 0) / 3 * 100;
                    progressBarFill.style.width = `${progress}%`;
                }
            }

            const transactionHistory = document.getElementById('transaction-history');
            if (transactionHistory) {
                transactionHistory.innerHTML = '';
                const sortedTransactions = (user.transactions || []).sort((a, b) => new Date(b.date) - new Date(a.date));
                sortedTransactions.forEach(tx => {
                    const li = document.createElement('li');
                    li.textContent = `${tx.date}: ${tx.type} $${tx.amount.toFixed(2)}`;
                    transactionHistory.appendChild(li);
                });
            }

            const pastVacationsGrid = document.getElementById('past-vacations-grid');
            if (pastVacationsGrid) {
                pastVacationsGrid.innerHTML = '';
                const completedVacations = user.completedVacations || [];
                if (completedVacations.length === 0) {
                    pastVacationsGrid.innerHTML = '<p>No past vacations yet.</p>';
                } else {
                    completedVacations.forEach((vacation, serverIndex) => {
                        const card = document.createElement('div');
                        card.classList.add('destination-card');
                        const cost = typeof vacation.cost === 'number' ? vacation.cost.toFixed(2) : 'N/A';
                        card.innerHTML = `
                            <img src="${vacation.image || 'images/default-pic.jpg'}" alt="${vacation.name || 'Unknown'}" loading="lazy">
                            <h3>${vacation.name || 'Unknown'}</h3>
                            <p>Completed: ${vacation.completedDate || 'N/A'}</p>
                            <p>Cost: $${cost}</p>
                            ${vacation.rating ? `<p>Rating: ${vacation.rating}/5 ${vacation.comment ? `- ${vacation.comment}` : ''}</p>` : ''}
                            <div class="button-container">
                                <button class="btn learn-more" data-name="${vacation.name || 'Unknown'}">Learn More</button>
                                <button class="btn rebook-now">Rebook Now</button>
                                <button class="btn rate-trip" data-index="${serverIndex}">${vacation.rating ? 'Edit Rating' : 'Rate Trip'}</button>
                            </div>
                        `;
                        pastVacationsGrid.appendChild(card);

                        const img = card.querySelector('img');
                        img.addEventListener('error', function handler() {
                            img.src = 'images/default-pic.jpg';
                            img.removeEventListener('error', handler);
                        });

                        card.querySelector('.learn-more').addEventListener('click', () => {
                            const destMatch = destinationsData.find(d => d.deluxePackage.name === vacation.name);
                            if (destMatch) showDeluxePackage(destMatch);
                        });
                        card.querySelector('.rebook-now').addEventListener('click', () => {
                            showBookingConfirmationModal(username, destinationsData.find(d => d.deluxePackage.name === vacation.name));
                        });
                        card.querySelector('.rate-trip').addEventListener('click', () => {
                            const index = parseInt(card.querySelector('.rate-trip').getAttribute('data-index'));
                            showRateTripModal(username, index, vacation);
                        });
                    });
                }
            }

            if (user.lastDepositAccepted && user.lastDepositAccepted.timestamp !== lastDepositTimestamp) {
                const storedTimestamp = localStorage.getItem('lastDepositTimestamp');
                if (storedTimestamp !== user.lastDepositAccepted.timestamp) {
                    lastDepositTimestamp = user.lastDepositAccepted.timestamp;
                    localStorage.setItem('lastDepositTimestamp', lastDepositTimestamp);
                    showDepositSuccessModal(user.lastDepositAccepted.amount);
                }
            }

            if (!localStorage.getItem('welcomeShown')) {
                showNotification('Welcome to your dashboard!');
                localStorage.setItem('welcomeShown', 'true');
            }

        
        })
        .catch(error => {
            console.error('Error loading user data:', error);
            if (error.message === 'Session expired or unauthorized') {
                showNotification('Session expired. Please log in again.');
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                window.location.href = 'login.html';
            } else {
                showNotification('Failed to load user data. Retrying...');
            }
        });
    }

    checkForDepositUpdates();
    updateInterval = setInterval(checkForDepositUpdates, 5000);
}

function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        console.log('Login form found');
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            console.log('Attempting login with:', username, password);
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    // Throw an error if the response isn’t successful (e.g., 401 or 500)
                    throw new Error(`Login failed with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Response data:', data);
                if (data.success) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', username);
                    window.location.href = 'client.html';
                } else {
                    const errorMessage = document.getElementById('error-message');
                    if (errorMessage) { // Check if the element exists to avoid errors
                        errorMessage.textContent = data.message || 'Invalid credentials';
                        errorMessage.classList.remove('hidden');
                    }
                    loginForm.reset();
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                const errorMessage = document.getElementById('error-message');
                if (errorMessage) { // Same check here
                    errorMessage.textContent = 'Login failed. Please try again.';
                    errorMessage.classList.remove('hidden');
                }
            });
        });
    } else {
        console.error('Login form not found');
    }
}

function showDepositSubmissionThankYouModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Thank You!</h2>
            <p>Your deposit has been successfully submitted and is pending approval. Thank you for choosing ExploreWorld!</p>
            <button id="close-modal" class="btn btn-primary">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    setTimeout(() => {
        if (modal.parentNode) document.body.removeChild(modal);
    }, 5000); // Auto-close after 5 seconds
}

function showAccountCreationThankYouModal() {
    console.log('Creating account creation thank you modal');
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
         <div class="modal-content">
            <h2>Welcome to ExploreWorld!</h2>
            <p>Thank you for creating an account with us. We’re delighted to welcome you to our community of passionate travelers. Your journey to extraordinary adventures starts here!</p>
            <p>You’ll be redirected to the login page in a moment. If you’re not redirected, <a href="login.html">click here</a>.</p>
            <button id="close-modal" class="btn btn-primary">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
    console.log('Modal appended to body:', modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
        window.location.href = 'login.html';
    });
    setTimeout(() => {
        if (modal.parentNode) {
            document.body.removeChild(modal);
            window.location.href = 'login.html';
        }
    }, 5000);
}

function showThankYouModal(destination) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    const packageName = destination?.deluxePackage?.name || 'Unknown Package';
    modal.innerHTML = `
        <div class="modal-content thank-you-modal">
            <h2>Thank You!</h2>
            <p>Your booking for <strong>${packageName}</strong> has been successfully requested.</p>
            <p>We appreciate your trust in ExploreWorld. Full details of your trip, including the confirmed date, will be sent to your email shortly.</p>
            <button id="close-modal" class="btn btn-primary">OK</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    setTimeout(() => {
        if (modal.parentNode) document.body.removeChild(modal);
    }, 5000);
}

function initCreateAccountForm() {
    const createAccountForm = document.getElementById('create-account-form');
    const errorMessage = document.getElementById('error-message');
    const submitButton = createAccountForm?.querySelector('button[type="submit"]');

    if (createAccountForm) {
        console.log('Create account form found');
        createAccountForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner"></span> Creating Account...';

            errorMessage.textContent = '';
            errorMessage.classList.add('hidden');

            const name = document.getElementById('name').value;
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            const phoneRegex = /^\+?[1-9]\d{1,14}$/;

            if (!name.trim()) {
                errorMessage.textContent = 'Name is required.';
                errorMessage.classList.remove('hidden');
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create Account';
                return;
            }

            if (!emailRegex.test(email)) {
                errorMessage.textContent = 'Invalid email format.';
                errorMessage.classList.remove('hidden');
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create Account';
                return;
            }

            if (phone && !phoneRegex.test(phone)) {
                errorMessage.textContent = 'Invalid phone number format (e.g., +1234567890).';
                errorMessage.classList.remove('hidden');
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create Account';
                return;
            }

            if (!passwordRegex.test(password)) {
                errorMessage.textContent = 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.';
                errorMessage.classList.remove('hidden');
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create Account';
                return;
            }

            if (password !== confirmPassword) {
                errorMessage.textContent = 'Passwords do not match.';
                errorMessage.classList.remove('hidden');
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create Account';
                return;
            }

            try {
                const response = await fetch('/api/create-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, username, email, phone, password })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', username);
                    showAccountCreationThankYouModal();
                } else {
                    errorMessage.textContent = data.message || 'Registration failed.';
                    errorMessage.classList.remove('hidden');
                    createAccountForm.reset();
                }
            } catch (error) {
                console.error('Registration error:', error);
                errorMessage.textContent = 'An error occurred while creating the account. Please try again.';
                errorMessage.classList.remove('hidden');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Create Account';
            }
        });
    } else {
        console.error('Create account form not found');
    }
}

function initMap() {
    const mapElement = document.getElementById('destination-map');
    if (!mapElement || typeof L === 'undefined') {
        console.error('Map element or Leaflet not found');
        return;
    }
    const map = L.map(mapElement).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    const destinations = [
        { name: 'Paris', coords: [48.8566, 2.3522] },
        { name: 'New York', coords: [40.7128, -74.0060] },
        { name: 'Tokyo', coords: [35.6762, 139.6503] },
        { name: 'Bali', coords: [-8.3405, 115.0920] },
        { name: 'Cape Town', coords: [-33.9249, 18.4241] },
        { name: 'Sydney', coords: [-33.8688, 151.2093] }
    ];
    destinations.forEach(dest => {
        L.marker(dest.coords).addTo(map)
            .bindPopup(dest.name)
            .on('click', () => {
                const destMatch = destinationsData.find(d => d.name === dest.name);
                if (destMatch) showDeluxePackage(destMatch);
            });
    });
}

function initTravelQuiz() {
    const quizForm = document.getElementById('travel-quiz-form');
    if (quizForm) {
        console.log('Travel quiz form found');
        quizForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Get Suggestion clicked!');
            try {
                const type = quizForm.querySelector('input[name="type"]:checked')?.value;
                const travel = quizForm.querySelector('input[name="travel"]:checked')?.value;
                let suggestion = 'Please select options to get a suggestion.';
                if (type && travel) {
                    if (type === 'beach' && travel === 'solo') suggestion = 'Try Bali for a relaxing solo beach getaway!';
                    else if (type === 'beach' && travel === 'group') suggestion = 'Head to Sydney for a fun group beach trip!';
                    else if (type === 'mountain' && travel === 'solo') suggestion = 'Cape Town offers stunning mountains for solo adventurers!';
                    else if (type === 'mountain' && travel === 'group') suggestion = 'Explore the Alps near Paris with your group!';
                }
                const result = document.getElementById('quiz-result');
                if (result) {
                    console.log('Displaying suggestion:', suggestion);
                    result.textContent = suggestion;
                } else {
                    console.error('Quiz result element not found');
                }
            } catch (error) {
                console.error('Quiz error:', error);
            }
        });
    } else {
        console.error('Travel quiz form not found');
        const getSuggestionBtn = document.querySelector('.get-suggestion');
        if (getSuggestionBtn) {
            console.log('Get Suggestion button found as fallback');
            getSuggestionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Get Suggestion clicked');
                const typeInputs = document.querySelectorAll('input[name="type"]');
                const travelInputs = document.querySelectorAll('input[name="travel"]');
                const type = Array.from(typeInputs).find(input => input.checked)?.value;
                const travel = Array.from(travelInputs).find(input => input.checked)?.value;
                let suggestion = 'Please select options to get a suggestion.';
                if (type && travel) {
                    if (type === 'beach' && travel === 'solo') suggestion = 'Try Bali for a relaxing solo beach getaway!';
                    else if (type === 'beach' && travel === 'group') suggestion = 'Head to Sydney for a fun group beach trip!';
                    else if (type === 'mountain' && travel === 'solo') suggestion = 'Cape Town offers stunning mountains for solo adventurers!';
                    else if (type === 'mountain' && travel === 'group') suggestion = 'Explore the Alps near Paris with your group!';
                }
                const result = document.getElementById('quiz-result');
                if (result) {
                    console.log('Displaying suggestion:', suggestion);
                    result.textContent = suggestion;
                } else {
                    console.error('Quiz result element not found');
                }
            });
        } else {
            console.error('No Get Suggestion button found as fallback');
        }
    }
}

function loadDestinations() {
    fetch('destinations.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load destinations');
            return response.json();
        })
        .then(data => {
            destinationsData = data;
            const grid = document.querySelector('.destination-grid');
            if (!grid) {
                console.error('Destination grid not found');
                return;
            }
            console.log('Destination grid found');
            grid.innerHTML = '';
            data.forEach((destination, index) => {
                const card = document.createElement('div');
                card.classList.add('destination-card');
                card.innerHTML = `
                    <img src="${destination.image}" alt="${destination.name}" loading="lazy">
                    <h3>${destination.name}</h3>
                    <p>${destination.description}</p>
                    <div class="button-container">
                        <button class="btn learn-more" data-index="${index}">Learn More</button>
                        <button class="btn book-now" data-index="${index}">Book Now</button>
                    </div>
                `;
                grid.appendChild(card);
            });

            document.querySelectorAll('.learn-more').forEach(button => {
                button.addEventListener('click', () => {
                    const index = parseInt(button.getAttribute('data-index'));
                    console.log('Learn More clicked for index:', index);
                    showDeluxePackage(destinationsData[index]);
                });
            });

            document.querySelectorAll('.book-now').forEach(button => {
                button.addEventListener('click', () => {
                    console.log('Book Now clicked, index:', button.getAttribute('data-index'));
                    const username = localStorage.getItem('username');
                    const index = parseInt(button.getAttribute('data-index'));
                    const destination = destinationsData[index];
                    if (!username) {
                        alert('Please log in to book a vacation.');
                        window.location.href = 'login.html';
                    } else {
                        showBookingConfirmationModal(username, destination);
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error loading destinations:', error);
            showNotification('Failed to load destinations. Please refresh.');
        });
}

function loadCurrentDestinations() {
    fetch('destinations.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load current destinations');
            return response.json();
        })
        .then(data => {
            destinationsData = data;
            const grid = document.getElementById('current-destinations-grid');
            if (!grid) {
                console.error('Current destinations grid not found');
                return;
            }
            console.log('Current destinations grid found');
            grid.innerHTML = '';
            data.forEach((destination, index) => {
                const card = document.createElement('div');
                card.classList.add('destination-card');
                card.innerHTML = `
                    <img src="${destination.image}" alt="${destination.name}" loading="lazy">
                    <h3>${destination.name}</h3>
                    <p>${destination.description}</p>
                    <div class="button-container">
                        <button class="btn learn-more" data-index="${index}">Learn More</button>
                        <button class="btn book-now" data-index="${index}">Book Now</button>
                    </div>
                `;
                grid.appendChild(card);
            });

            document.querySelectorAll('#current-destinations-grid .learn-more').forEach(button => {
                button.addEventListener('click', () => {
                    const index = parseInt(button.getAttribute('data-index'));
                    showDeluxePackage(destinationsData[index]);
                });
            });

            document.querySelectorAll('#current-destinations-grid .book-now').forEach(button => {
                button.addEventListener('click', () => {
                    const username = localStorage.getItem('username');
                    const index = parseInt(button.getAttribute('data-index'));
                    const destination = destinationsData[index];
                    showBookingConfirmationModal(username, destination);
                });
            });
        })
        .catch(error => console.error('Error loading current destinations:', error));
}

function showDeluxePackage(destination) {
    const existingModal = document.querySelector('.deluxe-package-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'deluxe-package-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${destination.deluxePackage.name}</h2>
            <p>${destination.longDescription}</p>
            <div>${destination.deluxePackage.details || '<p>No details available.</p>'}</div>
            <button id="book-now-btn" class="btn btn-success">Book Now</button>
            <button id="close-modal" class="btn btn-secondary">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('book-now-btn').addEventListener('click', () => {
        const username = localStorage.getItem('username');
        if (!username) {
            alert('Please log in to book a vacation.');
            window.location.href = 'login.html';
        } else {
            document.body.removeChild(modal);
            showBookingConfirmationModal(username, destination);
        }
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function closeModalOnOutsideClick(modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function showVerificationModal(message) {
    const modal = document.getElementById('verification-modal');
    document.getElementById('verification-message').textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('active');
    document.getElementById('verification-modal-ok').addEventListener('click', () => {
        modal.classList.remove('active');
        modal.classList.add('hidden');
    });
    document.getElementById('verification-modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
        modal.classList.add('hidden');
    });
}

async function bookVacation(username, cost, name) {
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please log in to book a vacation.');
        return false;
    }
    if (typeof cost !== 'number' || !name) {
        console.error('Invalid booking data:', { cost, name });
        showNotification('Error: Invalid booking data.');
        return false;
    }

    try {
        const response = await fetch(`/api/user/${username}/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                vacation: { cost, name, date: new Date().toISOString().split('T')[0] },
                bonus: 500
            })
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Session expired or unauthorized');
            }
            if (response.status === 400) {
                const data = await response.json();
                throw new Error(data.message || 'Insufficient balance');
            }
            throw new Error('Booking failed');
        }

        const data = await response.json();
        if (data.success) {
            if (window.location.pathname.split('/').pop() === 'client.html') {
                await loadUserData(username);
            }
            return true;
        } else {
            console.error('Booking failed:', data.message);
            showNotification(data.message || 'Booking failed');
            return false;
        }
    } catch (error) {
        console.error('Booking error:', error);
        if (error.message === 'Session expired or unauthorized') {
            showNotification('Session expired. Please log in again.');
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = 'login.html';
        } else {
            showNotification(error.message || 'Booking failed due to a server error. Please try again.');
        }
        return false;
    }
}

function initDepositForms(username) {
    // Bank Deposit Form Submission
    document.getElementById('bank-form').addEventListener('submit', async (e) => {
     e.preventDefault();
     const payerName = document.getElementById('payer-name').value;
     const amount = document.getElementById('bank-amount').value;
     const token = localStorage.getItem('token');
     const username = localStorage.getItem('username');
 
     console.log('Submitting deposit with:', { username, amount, payerName, token });
 
     try {
         const response = await fetch('/api/deposit/bank', {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}`
             },
             body: JSON.stringify({ username, amount: parseFloat(amount), payerName })
         });
         console.log('Response status:', response.status);
         const data = await response.json();
         console.log('Response data:', data);
 
         if (data.success) {
             showDepositSubmissionThankYouModal();
         } else {
             alert('Deposit failed: ' + data.message);
         }
     } catch (error) {
         console.error('Error during deposit submission:', error);
         alert('An error occurred during deposit submission');
     }
 }); 
 
 document.getElementById('btc-address-form')?.addEventListener('submit', async (e) => {
     e.preventDefault();
     const btcAddress = document.getElementById('btc-address').value;
     const token = localStorage.getItem('token');
 
     try {
         const response = await fetch('/api/admin/settings/btc-address', {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}`
             },
             body: JSON.stringify({ btcWalletAddress: btcAddress })
         });
         const data = await response.json();
         if (data.success) {
             alert('BTC address updated successfully');
         } else {
             alert('Failed to update BTC address: ' + data.message);
         }
     } catch (err) {
         alert('Error updating BTC address');
     }
 });
 
 // Payment method handling for "Pay to our verified travel agents"
 const paymentDetails = {
     paypal: 'PayPal email: payments@exploreworld.com',
     cashapp: 'Cash App tag: $ExploreWorld',
     venmo: 'Venmo account: @ExploreWorld',
     applepay: 'Apple Pay instructions: Use payments@exploreworld.com',
     zelle: 'Zelle account: payments@exploreworld.com'
 };
 
 document.getElementById('payment-method').addEventListener('change', (e) => {
     const method = e.target.value;
     document.getElementById('payment-details').innerHTML = paymentDetails[method];
 });
 
 // Generate QR Code
 document.getElementById('generate-qr').addEventListener('click', async () => {
     const amount = document.getElementById('crypto-qr-amount').value;
     if (!amount) {
         alert('Please enter an amount');
         return;
     }
     try {
         const token = localStorage.getItem('token');
         const response = await fetch('/api/settings/btc-address', {
             headers: {
                 'Authorization': `Bearer ${token}`
             }
         });
         if (!response.ok) {
             throw new Error('Failed to fetch wallet address');
         }
         const data = await response.json();
         const walletAddress = data.btcWalletAddress;
         const qrData = `bitcoin:${walletAddress}?amount=${amount / 30000}`; // Adjust conversion rate as needed
         document.getElementById('qrcode').innerHTML = '';
         QRCode.toCanvas(document.getElementById('qrcode'), qrData, { width: 200 }, (err) => {
             if (err) console.error('QRCode error:', err);
         });
     } catch (err) {
         console.error('Error generating QR code:', err);
         alert('Failed to generate QR code');
     }
 });
 
 // Crypto Deposit Form Submission
 document.getElementById('crypto-qr-form').addEventListener('submit', async (e) => {
     e.preventDefault();
     const amount = document.getElementById('crypto-qr-amount').value;
     const userBtcAddress = document.getElementById('user-btc-address').value;
     const token = localStorage.getItem('token');
     const username = localStorage.getItem('username');
 
     const response = await fetch('/api/deposit/crypto', {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`
         },
         body: JSON.stringify({ username, amount: parseFloat(amount), userBtcAddress })
     });
     const data = await response.json();
 
     if (data.success) {
         showDepositSubmissionThankYouModal();
     } else {
         alert('Deposit failed: ' + data.message);
     }
 });
 
 // Agent Deposit Form Submission (example, adjust endpoint as needed)
 document.getElementById('agent-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = document.getElementById('agent-amount').value;
    const transactionId = document.getElementById('transaction-id').value; // Note: This input is missing in HTML
    const paymentMethod = document.getElementById('agent-payment-method').value; // Updated to match select ID
    const token = localStorage.getItem('token');

    
    

    const response = await fetch('/api/deposit/agent', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, amount: parseFloat(amount), transactionId, paymentMethod })
    });
    const data = await response.json();

    if (data.success) {
        showDepositSubmissionThankYouModal();
    } else {
        alert('Deposit failed: ' + data.message);
    }
});
}

async function updateUser(username, updates) {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch(`/api/admin/update-user/${username}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Session expired or unauthorized');
            }
            throw new Error('Failed to update user');
        }
        const data = await response.json();
        if (data.success) {
            showNotification('User updated successfully.');
            loadUsers();
        } else {
            showNotification(data.message || 'Failed to update user.');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.message === 'Session expired or unauthorized') {
            showNotification('Admin session expired. Please log in again.');
            localStorage.removeItem('adminToken');
            document.getElementById('admin-panel').classList.add('hidden');
            document.getElementById('admin-login').classList.remove('hidden');
        } else {
            showNotification('Failed to update user. Please try again.');
        }
    }
}

function toggleVerified(username, isVerified) {
    const token = localStorage.getItem('adminToken');
    fetch(`/api/admin/verify/${username}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ verified: isVerified })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`User ${username} verification status updated.`);
            loadUsers();
        } else {
            showNotification(data.message || 'Failed to update verification status.');
        }
    })
    .catch(error => {
        console.error('Error toggling verification:', error);
        showNotification('Failed to update verification status. Please try again.');
    });
}

function clearVacationHistory(username) {
    if (confirm(`Clear vacation history for ${username}?`)) {
        const token = localStorage.getItem('adminToken');
        fetch(`/api/admin/clear-vacations/${username}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Session expired or unauthorized');
                }
                throw new Error('Failed to clear vacation history');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert(`Vacation history cleared for ${username}`);
                loadUsers();
            } else {
                alert(data.message || 'Failed to clear vacation history');
            }
        })
        .catch(error => {
            console.error('Error clearing vacation history:', error);
            if (error.message === 'Session expired or unauthorized') {
                showNotification('Admin session expired. Please log in again.');
                localStorage.removeItem('adminToken');
                document.getElementById('admin-panel').classList.add('hidden');
                document.getElementById('admin-login').classList.remove('hidden');
            } else {
                showNotification('Failed to clear vacation history. Please try again.');
            }
        });
    }
}

function clearTransactions(username) {
    if (confirm(`Clear transaction history for ${username}?`)) {
        const token = localStorage.getItem('adminToken');
        fetch(`/api/admin/clear-transactions/${username}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Session expired or unauthorized');
                }
                throw new Error('Failed to clear transactions');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert(`Transaction history cleared for ${username}`);
                loadUsers();
            } else {
                alert(data.message || 'Failed to clear transactions');
            }
        })
        .catch(error => {
            console.error('Error clearing transactions:', error);
            if (error.message === 'Session expired or unauthorized') {
                showNotification('Admin session expired. Please log in again.');
                localStorage.removeItem('adminToken');
                document.getElementById('admin-panel').classList.add('hidden');
                document.getElementById('admin-login').classList.remove('hidden');
            } else {
                showNotification('Failed to clear transactions. Please try again.');
            }
        });
    }
}

function loadUsers() {
    const token = localStorage.getItem('adminToken');
    fetch('/api/admin/users', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        cache: 'no-store'
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Session expired or unauthorized');
            }
            throw new Error('Failed to load users');
        }
        return response.json();
    })
    .then(data => {
        // Extract the users array from the response object
        const users = data.users;
        // Check if users is an array to avoid errors
        if (!Array.isArray(users)) {
            console.error('Expected an array for users, but got:', users);
            showNotification('Failed to load users: Invalid data format.');
            return;
        }
        const userList = document.getElementById('user-list');
        if (!userList) return;
        userList.innerHTML = '<button id="clear-users-btn" class="btn btn-danger">Clear All Users</button>';
        users.forEach(user => {
            const div = document.createElement('div');
            div.innerHTML = `
                <p><strong>${user.name}</strong> (${user.username}) - Verified: 
                    <input type="checkbox" ${user.verified ? 'checked' : ''} class="verify-checkbox" data-username="${user.username}">
                </p>
                <form class="edit-user-form" data-username="${user.username}">
                    <input type="text" name="name" value="${user.name}" placeholder="Name">
                    <input type="number" name="balance" value="${user.balance || 0}" placeholder="Balance">
                    <input type="number" name="bonus" value="${user.bonus || 0}" placeholder="Bonus">
                    <input type="number" name="deposits" value="${user.deposits || 0}" placeholder="Deposits">
                    <input type="text" name="email" value="${user.personalInfo?.email || user.email || ''}" placeholder="Email">
                    <input type="text" name="phone" value="${user.personalInfo?.phone || user.phone || ''}" placeholder="Phone">
                    <input type="text" name="address" value="${user.personalInfo?.address || ''}" placeholder="Address">
                    <input type="file" name="profilePic" accept="image/*">
                    <button type="submit" class="btn btn-primary">Update</button>
                </form>
                <button class="btn btn-danger btn-clear-vacations" data-username="${user.username}">Clear Vacation History</button>
                <button class="btn btn-danger btn-clear-transactions" data-username="${user.username}">Clear Transaction History</button>
                <button class="btn btn-danger btn-clear-past-vacations" data-username="${user.username}">Clear Past Vacations</button>
                <h3>Pending Deposits</h3>
                <ul id="pending-deposits-${user.username}">
                    ${(user.pendingDeposits || []).map((dep, i) => `
                        <li>$${dep.amount} via ${dep.method} (${dep.date}) 
                            <button class="btn btn-success accept-deposit" data-username="${user.username}" data-index="${i}">Accept</button>
                        </li>
                    `).join('')}
                </ul>
                <h3>Pending Vacations</h3>
                <ul id="pending-${user.username}">
                    ${(user.pendingVacations || []).map((v, i) => `
                        <li>${v.name || 'Unknown'} ($${typeof v.cost === 'number' ? v.cost.toFixed(2) : 'N/A'} - ${v.date || 'N/A'})
                            <button class="btn btn-success accept-vacation" data-username="${user.username}" data-index="${i}">Accept</button>
                        </li>
                    `).join('')}
                </ul>
                <h3>Upcoming Vacations</h3>
                <ul id="upcoming-${user.username}">
                    ${(user.upcomingVacations || []).map((v, i) => `
                        <li>${v.name || 'Unknown'} ($${typeof v.cost === 'number' ? v.cost.toFixed(2) : 'N/A'} - ${v.date || 'N/A'})
                            <button class="btn btn-primary complete-vacation" data-username="${user.username}" data-index="${i}">Mark as Completed</button>
                        </li>
                    `).join('')}
                </ul>
                <h3>Past Vacations</h3>
                <ul id="past-${user.username}">
                    ${(user.completedVacations || []).map((v, i) => `
                        <li>${v.name || 'Unknown'} ($${typeof v.cost === 'number' ? v.cost.toFixed(2) : 'N/A'} - ${v.completedDate || 'N/A'})${v.rating ? ` - Rated: ${v.rating}/5` : ''}
                            <button class="btn btn-primary edit-past-vacation" data-username="${user.username}" data-index="${i}">Edit</button>
                        </li>
                    `).join('')}
                </ul>
                <button class="btn btn-success add-past-vacation" data-username="${user.username}">Add Past Vacation</button>
            `;
            userList.appendChild(div);

            // Event listeners remain unchanged
            div.querySelector('.edit-user-form').addEventListener('submit', function(e) {
                e.preventDefault();
                const username = this.getAttribute('data-username');
                const formData = new FormData(this);
                const updates = {
                    name: formData.get('name'),
                    balance: parseFloat(formData.get('balance')),
                    bonus: parseFloat(formData.get('bonus')),
                    deposits: parseFloat(formData.get('deposits')),
                    personalInfo: {
                        email: formData.get('email'),
                        phone: formData.get('phone'),
                        address: formData.get('address')
                    }
                };
                const profilePic = formData.get('profilePic');
                if (profilePic.size > 0) {
                    uploadAdminProfilePic(username, formData);
                } else {
                    updateUser(username, updates);
                }
            });

            div.querySelectorAll('.verify-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    const username = this.getAttribute('data-username');
                    toggleVerified(username, this.checked);
                });
            });

            div.querySelector('.btn-clear-vacations').addEventListener('click', () => clearVacationHistory(user.username));
            div.querySelector('.btn-clear-transactions').addEventListener('click', () => clearTransactions(user.username));
            div.querySelector('.btn-clear-past-vacations').addEventListener('click', () => clearPastVacations(user.username));
            div.querySelectorAll('.accept-vacation').forEach(button => {
                button.addEventListener('click', () => {
                    const username = button.getAttribute('data-username');
                    const index = parseInt(button.getAttribute('data-index'));
                    acceptVacation(username, index);
                });
            });
            div.querySelectorAll('.complete-vacation').forEach(button => {
                button.addEventListener('click', () => {
                    const username = button.getAttribute('data-username');
                    const index = parseInt(button.getAttribute('data-index'));
                    completeVacation(username, index);
                });
            });
            div.querySelectorAll('.accept-deposit').forEach(button => {
                button.addEventListener('click', () => {
                    const username = button.getAttribute('data-username');
                    const index = parseInt(button.getAttribute('data-index'));
                    acceptDeposit(username, index);
                });
            });
            div.querySelectorAll('.edit-past-vacation').forEach(button => {
                button.addEventListener('click', () => {
                    const username = button.getAttribute('data-username');
                    const index = parseInt(button.getAttribute('data-index'));
                    const vacation = user.completedVacations[index];
                    showEditPastVacationModal(username, index, vacation);
                });
            });
            div.querySelector('.add-past-vacation').addEventListener('click', () => {
                showAddPastVacationModal(user.username);
            });
        });

        document.getElementById('clear-users-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all users? This cannot be undone.')) {
                fetch('/api/admin/clear-users', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 403) {
                            throw new Error('Session expired or unauthorized');
                        }
                        throw new Error('Failed to clear users');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        showNotification('All users cleared successfully.');
                        loadUsers();
                    } else {
                        showNotification(data.message || 'Failed to clear users.');
                    }
                })
                .catch(error => {
                    console.error('Error clearing users:', error);
                    if (error.message === 'Session expired or unauthorized') {
                        showNotification('Admin session expired. Please log in again.');
                        localStorage.removeItem('adminToken');
                        document.getElementById('admin-panel').classList.add('hidden');
                        document.getElementById('admin-login').classList.remove('hidden');
                    } else {
                        showNotification('Failed to clear users. Please try again.');
                    }
                });
            }
        });
    })
    .catch(error => {
        console.error('Error loading users:', error);
        if (error.message === 'Session expired or unauthorized') {
            showNotification('Admin session expired. Please log in again.');
            localStorage.removeItem('adminToken');
            document.getElementById('admin-panel').classList.add('hidden');
            document.getElementById('admin-login').classList.remove('hidden');
        } else {
            showNotification('Failed to load users. Please try again.');
        }
    });
}

if (window.location.pathname.split('/').pop() === 'admin.html' && localStorage.getItem('adminToken')) {
    fetch('/api/admin/users', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('admin-login').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            loadUsers();
        } else {
            localStorage.removeItem('adminToken');
            showNotification('Admin session expired. Please log in again.');
        }
    })
    .catch(() => {
        localStorage.removeItem('adminToken');
        showNotification('Failed to verify admin session.');
    });
}


function clearPastVacations(username) {
    if (confirm(`Clear past vacations for ${username}?`)) {
        const token = localStorage.getItem('adminToken');
        fetch(`/api/admin/clear-past-vacations/${username}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Session expired or unauthorized');
                }
                throw new Error('Failed to clear past vacations');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert(`Past vacations cleared for ${username}`);
                loadUsers();
            } else {
                alert(data.message || 'Failed to clear past vacations');
            }
        })
        .catch(error => {
            console.error('Error clearing past vacations:', error);
            if (error.message === 'Session expired or unauthorized') {
                showNotification('Admin session expired. Please log in again.');
                localStorage.removeItem('adminToken');
                document.getElementById('admin-panel').classList.add('hidden');
                document.getElementById('admin-login').classList.remove('hidden');
            } else {
                showNotification('Failed to clear past vacations. Please try again.');
            }
        });
    }
}

function acceptVacation(username, vacationIndex) {
    const token = localStorage.getItem('adminToken');
    fetch(`/api/admin/accept-vacation/${username}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vacationIndex })
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Session expired or unauthorized');
            }
            throw new Error('Failed to accept vacation');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert(`Vacation accepted for ${username}`);
            loadUsers();
        } else {
            alert(data.message || 'Failed to accept vacation');
        }
    })
    .catch(error => {
        console.error('Error accepting vacation:', error);
        if (error.message === 'Session expired or unauthorized') {
            showNotification('Admin session expired. Please log in again.');
            localStorage.removeItem('adminToken');
            document.getElementById('admin-panel').classList.add('hidden');
            document.getElementById('admin-login').classList.remove('hidden');
        } else {
            showNotification('Failed to accept vacation. Please try again.');
        }
    });
}

function completeVacation(username, vacationIndex) {
    const token = localStorage.getItem('adminToken');
    fetch(`/api/admin/complete-vacation/${username}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ vacationIndex })
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Session expired or unauthorized');
            }
            throw new Error('Failed to complete vacation');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert(`Vacation marked as completed for ${username}`);
            loadUsers();
        } else {
            alert(data.message || 'Failed to complete vacation');
        }
    })
    .catch(error => {
        console.error('Error completing vacation:', error);
        if (error.message === 'Session expired or unauthorized') {
            showNotification('Admin session expired. Please log in again.');
            localStorage.removeItem('adminToken');
            document.getElementById('admin-panel').classList.add('hidden');
            document.getElementById('admin-login').classList.remove('hidden');
        } else {
            showNotification('Failed to complete vacation. Please try again.');
        }
    });
}

function acceptDeposit(username, depositIndex) {
    const token = localStorage.getItem('adminToken');
    fetch(`/api/admin/accept-deposit/${username}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ depositIndex })
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Session expired or unauthorized');
            }
            throw new Error('Failed to accept deposit');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert(`Deposit accepted for ${username}`);
            loadUsers();
        } else {
            alert(data.message || 'Failed to accept deposit');
        }
    })
    .catch(error => {
        console.error('Error accepting deposit:', error);
        if (error.message === 'Session expired or unauthorized') {
            showNotification('Admin session expired. Please log in again.');
            localStorage.removeItem('adminToken');
            document.getElementById('admin-panel').classList.add('hidden');
            document.getElementById('admin-login').classList.remove('hidden');
        } else {
            showNotification('Failed to accept deposit. Please try again.');
        }
    });
}

function showEditPastVacationModal(username, index, vacation) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Edit Past Vacation</h2>
            <form id="edit-past-vacation-form">
                <label>Name: <input type="text" name="name" value="${vacation.name}" required></label>
                <label>Cost: <input type="number" name="cost" value="${vacation.cost}" step="0.01" required></label>
                <label>Completed Date: <input type="date" name="completedDate" value="${vacation.completedDate}" required></label>
                <label>Image URL: <input type="text" name="image" value="${vacation.image || ''}" placeholder="Optional image URL"></label>
                <button type="submit" class="btn btn-primary">Save</button>
                <button type="button" class="btn btn-secondary" id="close-modal">Cancel</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('edit-past-vacation-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedVacation = {
            name: formData.get('name'),
            cost: parseFloat(formData.get('cost')),
            completedDate: formData.get('completedDate'),
            image: formData.get('image') || undefined
        };
        if (vacation.rating) updatedVacation.rating = vacation.rating;
        if (vacation.comment) updatedVacation.comment = vacation.comment;

        const token = localStorage.getItem('adminToken');
        fetch(`/api/admin/update-past-vacation/${username}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ index, ...updatedVacation })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Session expired or unauthorized');
                }
                throw new Error('Failed to update past vacation');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('Past vacation updated!');
                loadUsers();
                document.body.removeChild(modal);
            } else {
                alert(data.message || 'Failed to update past vacation');
            }
        })
        .catch(error => {
            console.error('Error updating past vacation:', error);
            if (error.message === 'Session expired or unauthorized') {
                showNotification('Admin session expired. Please log in again.');
                localStorage.removeItem('adminToken');
                document.getElementById('admin-panel').classList.add('hidden');
                document.getElementById('admin-login').classList.remove('hidden');
            } else {
                showNotification('Failed to update past vacation. Please try again.');
            }
        });
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function showAddPastVacationModal(username) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Add Past Vacation</h2>
            <form id="add-past-vacation-form">
                <label>Name: <input type="text" name="name" required></label>
                <label>Cost: <input type="number" name="cost" step="0.01" required></label>
                <label>Completed Date: <input type="date" name="completedDate" required></label>
                <label>Image URL: <input type="text" name="image" placeholder="Optional image URL"></label>
                <button type="submit" class="btn btn-primary">Add</button>
                <button type="button" class="btn btn-secondary" id="close-modal">Cancel</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('add-past-vacation-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newVacation = {
            name: formData.get('name'),
            cost: parseFloat(formData.get('cost')),
            completedDate: formData.get('completedDate'),
            image: formData.get('image') || undefined
        };

        const token = localStorage.getItem('adminToken');
        fetch(`/api/admin/update-past-vacation/${username}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ add: newVacation })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Session expired or unauthorized');
                }
                throw new Error('Failed to add past vacation');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('Past vacation added!');
                loadUsers();
                document.body.removeChild(modal);
            } else {
                alert(data.message || 'Failed to add past vacation');
            }
        })
        .catch(error => {
            console.error('Error adding past vacation:', error);
            if (error.message === 'Session expired or unauthorized') {
                showNotification('Admin session expired. Please log in again.');
                localStorage.removeItem('adminToken');
                document.getElementById('admin-panel').classList.add('hidden');
                document.getElementById('admin-login').classList.remove('hidden');
            } else {
                showNotification('Failed to add past vacation. Please try again.');
            }
        });
    }); 

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

async function showBookingConfirmationModal(username, destination) {
    console.log('Showing modal for:', destination?.deluxePackage?.name || 'Unknown');

    const token = localStorage.getItem('token');
    let currentBalance = 0;
    let userData = null;

    if (!destination || !destination.deluxePackage) {
        console.error('Invalid destination object:', destination);
        showNotification('Error: Invalid booking data.');
        return;
    }

    if (token) {
        try {
            const response = await fetch(`/api/user/${username}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json' 
                }
            });
            if (!response.ok) {
                throw new Error(`Fetch failed with status: ${response.status}`);
            }
            userData = await response.json();
            console.log('User data fetched:', userData);
            currentBalance = userData?.balance ?? 0;
        } catch (error) {
            console.error('Error fetching user data:', error.message);
            showNotification('Could not fetch your balance. Assuming $0 for now.');
        }
    } else {
        console.warn('No token found in localStorage');
        showNotification('Please log in to see your balance.');
    }

    const bookingDate = new Date().toISOString().split('T')[0];
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Confirm Booking</h2>
            <p><strong>Package:</strong> ${destination.deluxePackage.name}</p>
            <p><strong>Cost:</strong> $${destination.deluxePackage.price.toFixed(2)}</p>
            <p><strong>Date:</strong> ${bookingDate}</p>
            <p><strong>Current Balance:</strong> $${currentBalance.toFixed(2)}</p>
            <p>Are you sure? New balance: $${(currentBalance - destination.deluxePackage.price).toFixed(2)}</p>
            <button id="confirm-booking" class="btn btn-success">Confirm</button>
            <button id="cancel-booking" class="btn btn-secondary">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('confirm-booking').addEventListener('click', async () => {
        const success = await bookVacation(username, destination.deluxePackage.price, destination.deluxePackage.name);
        if (success) {
            showThankYouModal(destination);
            document.body.removeChild(modal);
        }
    });

    document.getElementById('cancel-booking').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function showDepositSuccessModal(amount) {
    const modal = document.createElement('div');
    modal.className = 'modal active'; // Ensure consistency with "active" class
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Thank You!</h2>
            <p>Your deposit of $${amount.toFixed(2)} has been accepted and added to your balance. Thank you for your trust in ExploreWorld!</p>
            <button id="close-modal" class="btn btn-primary">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function showRateTripModal(username, index, vacation) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Rate Your Trip to ${vacation.name}</h2>
            <form id="rate-trip-form">
                <label>Rating (1-5): 
                    <input type="number" name="rating" min="1" max="5" value="${vacation.rating || 5}" required>
                </label>
                <label>Comment: 
                    <textarea name="comment">${vacation.comment || ''}</textarea>
                </label>
                <button type="submit" class="btn btn-primary">Submit</button>
                <button type="button" class="btn btn-secondary" id="close-modal">Cancel</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    closeModalOnOutsideClick(modal);

    document.getElementById('rate-trip-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const rating = parseInt(formData.get('rating'));
        const comment = formData.get('comment');

        const token = localStorage.getItem('token');
        fetch(`/api/user/${username}/rate-vacation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ index, rating, comment })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Session expired or unauthorized');
                }
                throw new Error('Failed to submit rating');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('Rating submitted!');
                loadUserData(username);
                document.body.removeChild(modal);
            } else {
                alert(data.message || 'Failed to submit rating');
            }
        })
        .catch(error => {
            console.error('Error submitting rating:', error);
            if (error.message === 'Session expired or unauthorized') {
                showNotification('Session expired. Please log in again.');
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                window.location.href = 'login.html';
            } else {
                showNotification('Failed to submit rating. Please try again.');
            }
        });
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.innerHTML = username ? `
            <li><a href="index.html">Home</a></li>
            <li><a href="index.html#destinations">Destinations</a></li>
            <li><a href="client.html" id="client-link">Client Area</a></li>
            <li><a href="index.html#hot-destinations">Hot Destinations</a></li>
            <li><a href="deposit.html">Deposit</a></li>
            <li><a href="#" id="logout-btn">Logout</a></li>
        ` : `
            <li><a href="index.html">Home</a></li>
            <li><a href="index.html#destinations">Destinations</a></li>
            <li><a href="index.html#hot-destinations">Hot Destinations</a></li>
            <li><a href="login.html">Login</a></li>
            <li><a href="create-account.html">Create Account</a></li>
        `;
    } else {
        console.error('nav-links element not found');
    }


    initMenu();
    loadSocialMedia();
    initTravelQuiz();
    loadDestinations();
    initHotDestinations();
    if (window.location.pathname.split('/').pop() === 'client.html') {
        loadCurrentDestinations();
    }

    if (window.location.pathname.split('/').pop() === 'login.html') {
        initLoginForm();
    }
    if (window.location.pathname.includes('create-account.html')) {
        initCreateAccountForm();
    }

    try {
        initMap();
    } catch (e) {
        console.error('Map init failed:', e);
    }

    if (window.location.pathname.split('/').pop() === 'deposit.html') {
        if (username) {
            initDepositForms(username);
        } else {
            showNotification('Please log in to make a deposit.');
            window.location.href = 'login.html';
        }
    }

    const getStartedBtns = document.querySelectorAll('.get-started');
    if (getStartedBtns.length > 0) {
        console.log(`Found ${getStartedBtns.length} Get Started buttons`);
        getStartedBtns.forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Get Started clicked!');
                window.location.href = username ? 'client.html' : 'login.html';
            });
        });
    } else {
        console.error('No Get Started buttons found with class .get-started');
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = 'index.html';
        });
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.get('name'),
                    email: formData.get('email'),
                    message: formData.get('message')
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Message sent successfully!');
                    contactForm.reset();
                } else {
                    showNotification('Failed to send message. Please try again.');
                }
            })
            .catch(error => {
                console.error('Contact form error:', error);
                showNotification('Failed to send message due to a server error.');
            });
        });
    }

    const newsletterForm = document.querySelector('.newsletter');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = newsletterForm.querySelector('input[type="email"]').value;
            fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Subscribed successfully!');
                    newsletterForm.reset();
                } else {
                    showNotification('Subscription failed. Please try again.');
                }
            })
            .catch(error => {
                console.error('Newsletter error:', error);
                showNotification('Subscription failed due to a server error.');
            });
        });
    }

    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.querySelector('h3').addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });

    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value.trim();
            const password = document.getElementById('admin-password').value;
            if (!username || !password) {
                showNotification('Please enter both username and password.');
                return;
            }
            fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('adminToken', data.token);
                    document.getElementById('admin-login').classList.add('hidden');
                    document.getElementById('admin-panel').classList.remove('hidden');
                    loadUsers();
                } else {
                    showNotification('Admin login failed. Invalid credentials.');
                }
            })
            .catch(error => {
                console.error('Admin login error:', error);
                showNotification('Admin login failed due to a server error.');
            });
        });
    }

    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('adminToken');
            document.getElementById('admin-panel').classList.add('hidden');
            document.getElementById('admin-login').classList.remove('hidden');
        });
    }

});

function initHotDestinations() {
    const slideshow = document.querySelector('.hot-destinations-slideshow');
    if (!slideshow) {
        console.error('Hot destinations slideshow element not found');
        return;
    }

    fetch('/api/hot-destinations')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(backendData => {
            const hotDestinations = [
                {
                    name: "Oslo, Norway",
                    packageName: "Nordic Fjord Expedition",
                    image: "images/oslo.jpg",
                    booked: 120,
                    date: "2025-08-15",
                    deadline: "2025-07-10",
                    bonus: "10% off for couples",
                    cost: 28999
                },
                {
                    name: "Athens, Greece",
                    packageName: "Hellenic Isles Odyssey",
                    image: "images/athens.jpg",
                    booked: 85,
                    date: "2024-01-20",
                    deadline: "2023-12-20",
                    bonus: "Free upgrade to deluxe package",
                    cost: 27999
                },
                {
                    name: "Kyoto, Japan",
                    packageName: "Japanese Zen Journey",
                    image: "images/kyoto.jpg",
                    booked: 200,
                    date: "2024-03-10",
                    deadline: "2024-02-10",
                    bonus: "Complimentary spa day",
                    cost: 27999
                },
                {
                    name: "Beijing, China",
                    packageName: "Silk Road & Sea Adventure",
                    image: "images/beijing.jpg",
                    booked: 150,
                    date: "2025-07-05",
                    deadline: "2024-03-05",
                    bonus: "Exclusive cultural tour",
                    cost: 22999
                }
            ].map(dest => {
                const backendDest = backendData.find(b => b.name === dest.name);
                return {
                    ...dest,
                    fullyBooked: backendDest ? backendDest.fullyBooked : false
                };
            });

            slideshow.innerHTML = ''; // Clear existing slides

            hotDestinations.forEach((dest, index) => {
                const slide = document.createElement('div');
                slide.className = `hot-slide ${index === 0 ? 'active' : ''} ${dest.fullyBooked ? 'fully-booked' : ''}`;
                slide.innerHTML = `
                    <img src="${dest.image}" alt="${dest.name}">
                    ${dest.fullyBooked ? '<div class="fully-booked-stamp">Fully Booked - 700+ Travelers Booked This! Check Other Packages</div>' : ''}
                    <div class="hot-slide-content">
                        <h3>${dest.name}</h3>
                        <p>Booked by ${dest.booked} travelers</p>
                        <p>Vacation Date: ${dest.date}</p>
                        <p>Booking Deadline: ${dest.deadline}</p>
                        <p>Bonus: ${dest.bonus}</p>
                        ${dest.fullyBooked ? '' : `<button class="btn book-now-hot" data-package-name="${dest.packageName}" data-cost="${dest.cost}">Book Now</button>`}
                    </div>
                `;
                slideshow.appendChild(slide);
            });

            let currentSlide = 0;
            const slides = document.querySelectorAll('.hot-slide');
            function showNextSlide() {
                slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide + 1) % slides.length;
                slides[currentSlide].classList.add('active');
            }
            setInterval(showNextSlide, 10000);

            // Modal handling
            document.querySelectorAll('.book-now-hot').forEach(button => {
                button.addEventListener('click', () => {
                    const username = localStorage.getItem('username');
                    if (!username) {
                        alert('Please log in to book a vacation.');
                        window.location.href = 'login.html';
                        return;
                    }

                    const packageName = button.getAttribute('data-package-name');
                    const cost = parseFloat(button.getAttribute('data-cost'));
                    const dest = hotDestinations.find(d => d.packageName === packageName);

                    if (dest) {
                        showBookingModal(dest, username, cost);
                    }
                });
            });
        })

        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                content.classList.toggle('hidden');
            });
        });
}

// Function to show the booking modal using your existing modal structure
function showBookingModal(dest, username, cost) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="modal-close">×</span>
            <div class="modal-inner">
                <div class="modal-info">
                    <h2 id="modal-title">Booking Details</h2>
                    <p id="modal-description">
                        <span class="highlight">Package:</span> ${dest.packageName}<br>
                        <span class="highlight">Destination:</span> ${dest.name}<br>
                        <span class="highlight">Cost:</span> $${cost.toLocaleString()}<br>
                        <span class="highlight">Vacation Date:</span> ${dest.date}<br>
                        <span class="highlight">Booking Deadline:</span> ${dest.deadline}<br>
                        <span class="highlight">Bonus:</span> ${dest.bonus}
                    </p>
                </div>
                <div class="modal-action">
                    <button class="btn confirm-btn" id="modal-action-btn">Confirm</button>
                    <button class="btn cancel-btn">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    setTimeout(() => modal.classList.add('active'), 10);

    const closeBtn = modal.querySelector('.modal-close');
    const confirmBtn = modal.querySelector('.confirm-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');

    closeBtn.addEventListener('click', () => modal.remove());
    confirmBtn.addEventListener('click', () => {
        bookVacation(username, cost, dest.packageName);
        modal.remove();
    });
    cancelBtn.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}
