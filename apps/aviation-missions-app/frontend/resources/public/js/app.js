// Aviation Mission Management - Pure JavaScript Frontend
// Modern ES6+ implementation with clean architecture

class AviationMissionApp {
    constructor() {
        this.apiBaseUrl = '';
        this.missions = [];
        this.filteredMissions = [];
        this.filters = {
            search: '',
            category: 'all',
            difficulty: 'all',
            pilot_experience: 'all'
        };
        this.isLoading = true;
        this.error = null;

        console.log('🚀 Aviation Mission App initializing...');
        this.init();
    }

    async init() {
        try {
            this.createAppStructure();
            this.bindEventListeners();
            await this.checkAdminStatus(); // Check if user is already logged in
            await this.loadMissions();
            this.render();
            console.log('✅ Aviation Mission App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }

    createAppStructure() {
        const app = document.getElementById('app');
        if (!app) {
            throw new Error('App container not found');
        }

        app.innerHTML = `
            <div class="app-container">
                <header class="app-header">
                    <div class="header-content">
                        <div class="header-text">
                            <h1>✈️ Aviation Mission Management</h1>
                            <p>Manage and track aviation missions</p>
                        </div>
                        <div class="header-actions">
                            <button class="btn btn-primary" onclick="app.showNewMissionForm()">Create Mission</button>
                            <button class="btn btn-secondary" onclick="app.showAdminLogin()">Admin Login</button>
                        </div>
                    </div>
                </header>

                <div class="filters-panel" id="filtersPanel" style="display: none;">
                    <div class="search-container">
                        <input type="text" id="searchInput" placeholder="Search missions by title, description, or route..." />
                    </div>
                    <div class="filter-container">
                        <label>Category:</label>
                        <select id="categoryFilter">
                            <option value="all">All Categories</option>
                        </select>
                    </div>
                    <div class="filter-container">
                        <label>Difficulty:</label>
                        <select id="difficultyFilter">
                            <option value="all">All Difficulties</option>
                            <option value="1">1 - Easy</option>
                            <option value="2">2 - Medium</option>
                            <option value="3">3 - Hard</option>
                            <option value="4">4 - Hard</option>
                            <option value="5">5 - Hard</option>
                            <option value="6">6 - Expert</option>
                            <option value="7">7 - Expert</option>
                            <option value="8">8 - Expert</option>
                            <option value="9">9 - Expert</option>
                        </select>
                    </div>
                    <div class="filter-container">
                        <label>Pilot Experience:</label>
                        <select id="experienceFilter">
                            <option value="all">All Experience Levels</option>
                        </select>
                    </div>
                    <div class="fab" onclick="app.showNewMissionForm()">
                        <span class="fab-icon">✈️</span>
                        <span class="fab-label">Create Mission</span>
                    </div>
                </div>

                <div class="content-area" id="contentArea">
                    <div class="loading-indicator" id="loadingIndicator">
                        <div class="spinner"></div>
                        <p>Loading missions...</p>
                    </div>

                    <div class="error-display" id="errorDisplay" style="display: none;">
                        <h3>Error</h3>
                        <p id="errorMessage"></p>
                        <button id="retryBtn" class="btn btn-secondary">Retry</button>
                    </div>

                    <div class="missions-grid" id="missionsGrid" style="display: none;"></div>
                </div>

                <!-- Success sentinel for testing -->
                <div id="app-loaded-sentinel" style="position: fixed; top: -1000px; left: -1000px; opacity: 0; pointer-events: none;">
                    <!-- AVIATION_MISSIONS_APP_FULLY_LOADED -->
                </div>
            </div>
        `;
    }

    bindEventListeners() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.filterMissions();
        });

        // Filter dropdowns
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.filterMissions();
        });

        const difficultyFilter = document.getElementById('difficultyFilter');
        difficultyFilter.addEventListener('change', (e) => {
            this.filters.difficulty = e.target.value;
            this.filterMissions();
        });

        const experienceFilter = document.getElementById('experienceFilter');
        experienceFilter.addEventListener('change', (e) => {
            this.filters.pilot_experience = e.target.value;
            this.filterMissions();
        });

        // Remove old button listeners since we're using FAB now

        const retryBtn = document.getElementById('retryBtn');
        retryBtn.addEventListener('click', () => this.loadMissions());
    }

    async loadMissions() {
        console.log('📡 Loading missions from API...');
        this.isLoading = true;
        this.error = null;
        this.updateLoadingState();

        try {
            const response = await fetch(`${this.apiBaseUrl}/missions`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.missions = data.missions || [];
            this.filteredMissions = [...this.missions];
            this.isLoading = false;

            console.log(`✅ Loaded ${this.missions.length} missions`);
            this.populateFilterOptions();
            this.render();

        } catch (error) {
            console.error('❌ Failed to load missions:', error);
            this.isLoading = false;
            this.error = error.message;
            this.updateLoadingState();
        }
    }

    populateFilterOptions() {
        // Populate category filter
        const categories = [...new Set(this.missions.map(m => m.category).filter(Boolean))].sort();
        const categoryFilter = document.getElementById('categoryFilter');
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });

        // Populate difficulty filter with only existing levels
        const difficulties = [...new Set(this.missions.map(m => m.difficulty).filter(d => d != null))].sort((a, b) => a - b);
        const difficultyFilter = document.getElementById('difficultyFilter');
        // Clear existing options except "All Difficulties"
        difficultyFilter.innerHTML = '<option value="all">All Difficulties</option>';
        difficulties.forEach(difficulty => {
            const option = document.createElement('option');
            option.value = difficulty;
            option.textContent = `${difficulty} - ${this.getDifficultyLabel(difficulty)}`;
            difficultyFilter.appendChild(option);
        });

        // Populate experience filter
        const experiences = [...new Set(this.missions.map(m => m.pilot_experience).filter(Boolean))].sort();
        const experienceFilter = document.getElementById('experienceFilter');
        experiences.forEach(experience => {
            const option = document.createElement('option');
            option.value = experience;
            option.textContent = experience;
            experienceFilter.appendChild(option);
        });
    }

    filterMissions() {
        console.log('🔍 Filtering missions with:', this.filters);

        this.filteredMissions = this.missions.filter(mission => {
            // Category filter
            if (this.filters.category !== 'all' && mission.category !== this.filters.category) {
                return false;
            }

            // Difficulty filter
            if (this.filters.difficulty !== 'all' && String(mission.difficulty) !== this.filters.difficulty) {
                return false;
            }

            // Pilot experience filter
            if (this.filters.pilot_experience !== 'all' && mission.pilot_experience !== this.filters.pilot_experience) {
                return false;
            }

            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const titleMatch = mission.title && mission.title.toLowerCase().includes(searchTerm);
                const descMatch = mission.mission_description && mission.mission_description.toLowerCase().includes(searchTerm);
                const objMatch = mission.objective && mission.objective.toLowerCase().includes(searchTerm);
                const routeMatch = mission.route && mission.route.toLowerCase().includes(searchTerm);
                const categoryMatch = mission.category && mission.category.toLowerCase().includes(searchTerm);

                if (!titleMatch && !descMatch && !objMatch && !routeMatch && !categoryMatch) {
                    return false;
                }
            }

            return true;
        });

        console.log(`📊 Filtered to ${this.filteredMissions.length} missions`);
        this.renderMissions();
    }

    updateLoadingState() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const errorDisplay = document.getElementById('errorDisplay');
        const missionsGrid = document.getElementById('missionsGrid');
        const filtersPanel = document.getElementById('filtersPanel');

        if (this.isLoading) {
            loadingIndicator.style.display = 'flex';
            errorDisplay.style.display = 'none';
            missionsGrid.style.display = 'none';
            filtersPanel.style.display = 'none';
        } else if (this.error) {
            loadingIndicator.style.display = 'none';
            errorDisplay.style.display = 'block';
            missionsGrid.style.display = 'none';
            filtersPanel.style.display = 'none';
            document.getElementById('errorMessage').textContent = this.error;
        } else {
            loadingIndicator.style.display = 'none';
            errorDisplay.style.display = 'none';
            missionsGrid.style.display = 'grid';
            filtersPanel.style.display = 'flex';
        }
    }

    render() {
        this.updateLoadingState();

        if (!this.isLoading && !this.error) {
            this.renderMissions();
        }
    }

    renderMissions() {
        const missionsGrid = document.getElementById('missionsGrid');

        if (this.filteredMissions.length === 0) {
            missionsGrid.innerHTML = `
                <div class="empty-state">
                    <p>No missions found matching your criteria.</p>
                </div>
            `;
            return;
        }

        const missionsHTML = this.filteredMissions.map(mission => this.renderMissionCard(mission)).join('');
        missionsGrid.innerHTML = missionsHTML;
    }

    renderMissionCard(mission) {
        const difficultyLevel = mission.difficulty || 1;
        const challenges = this.analyzeMissionChallenges(mission);
        const experienceLevel = this.formatExperienceLevel(mission.pilot_experience);

        return `
            <div class="mission-card" data-mission-id="${mission.id}" onclick="app.viewMission(${mission.id})">
                <!-- Mission Header -->
                <div class="mission-header">
                    <h3 class="mission-title">${this.escapeHtml(mission.title)}</h3>
                    <div class="mission-meta">
                        <span class="category-badge">${this.escapeHtml(mission.category)}</span>
                        <span class="difficulty-badge badge-difficulty-${difficultyLevel}">
                            ${this.getDifficultyLabel(difficultyLevel)}
                        </span>
                        <span class="experience-badge">${experienceLevel}</span>
                    </div>
                </div>

                <!-- Mission Content -->
                <div class="mission-content">
                    <div class="mission-data-grid">
                        <span class="mission-data-label">ROUTE:</span>
                        <span class="mission-data-value">${this.escapeHtml(mission.route || 'See description')}</span>

                        <span class="mission-data-label">OBJECTIVE:</span>
                        <span class="mission-data-value">${this.escapeHtml(mission.objective || mission.mission_description)}</span>

                        <span class="mission-data-label">DESCRIPTION:</span>
                        <span class="mission-data-value">${this.escapeHtml(mission.mission_description)}</span>
                    </div>

                    ${challenges.length > 0 ? this.renderChallenges(challenges) : ''}

                    ${mission.notes ? `
                    <div class="mission-section">
                        <h4>Notes</h4>
                        <p>${this.escapeHtml(mission.notes)}</p>
                    </div>
                    ` : ''}

                    ${mission.special_challenges ? `
                    <div class="mission-section">
                        <h4>Special Challenges</h4>
                        <p>${this.escapeHtml(mission.special_challenges)}</p>
                    </div>
                    ` : ''}
                </div>

                <!-- Mission Footer -->
                <div class="mission-footer">
                    <div class="pilot-experience">MIN EXP: ${experienceLevel}</div>

                    <div class="mission-stats">
                        <button class="stat-item stat-button" onclick="event.stopPropagation(); app.viewComments(${mission.id})" title="View and add comments">
                            <span class="stat-icon">💬</span>
                            <span class="stat-count">${mission.comment_count || 0}</span>
                            <span class="stat-label">Comments</span>
                        </button>

                        <button class="stat-item stat-button" onclick="event.stopPropagation(); app.markCompleted(${mission.id})" title="Mark mission as completed">
                            <span class="stat-icon">✓</span>
                            <span class="stat-count">${mission.completion_count || 0}</span>
                            <span class="stat-label">Completed</span>
                        </button>

                        <button class="btn-mission primary" onclick="event.stopPropagation(); app.viewMission(${mission.id})">
                            BRIEF
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    analyzeMissionChallenges(mission) {
        const challenges = [];
        const description = (mission.mission_description || '').toLowerCase();
        const route = (mission.route || '').toLowerCase();
        const title = (mission.title || '').toLowerCase();
        const notes = (mission.notes || '').toLowerCase();
        const allText = `${description} ${route} ${title} ${notes}`;

        // High DA challenges
        if (allText.includes('density altitude') || allText.includes('high altitude') ||
            allText.includes('mountain') || allText.includes('sierra') ||
            allText.includes('truckee') || allText.includes('tahoe')) {
            challenges.push({ type: 'high-da', label: 'High DA' });
        }

        // Mountain Flying
        if ((allText.includes('mountain') && (allText.includes('flying') || allText.includes('terrain'))) ||
            allText.includes('sierra')) {
            challenges.push({ type: 'mountain-flying', label: 'Mountain Flying' });
        }

        // Complex Airspace
        if (allText.includes('class b') || allText.includes('class c') ||
            allText.includes('bravo') || allText.includes('charlie') ||
            allText.includes('clearance') || allText.includes('atc')) {
            challenges.push({ type: 'complex-airspace', label: 'Complex Airspace' });
        }

        // Short Runway
        if (allText.includes('short') || allText.includes('0q5') ||
            allText.includes('shelter cove')) {
            challenges.push({ type: 'short-runway', label: 'Short Runway' });
        }

        // Time Restrictions
        if (allText.includes('time') || allText.includes('morning departure') ||
            allText.includes('afternoon') || allText.includes('busy')) {
            challenges.push({ type: 'time-restrictions', label: 'Time Restrictions' });
        }

        return challenges;
    }

    renderChallenges(challenges) {
        return `
            <div class="challenges-section">
                <h4>FLIGHT CHALLENGES</h4>
                <div class="challenges-grid">
                    ${challenges.map(challenge => `
                        <div class="challenge-item">
                            <span class="challenge-icon">⚠</span>
                            <span class="challenge-label">${challenge.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getDifficultyLabel(level) {
        if (level <= 1) return 'EASY';
        if (level <= 2) return 'MEDIUM';
        if (level <= 5) return 'HARD';
        return 'EXPERT';
    }

    formatExperienceLevel(experience) {
        if (!experience) return 'STUDENT';
        const exp = experience.toLowerCase();
        if (exp.includes('beginner')) return 'STUDENT';
        if (exp.includes('intermediate')) return 'PRIVATE';
        if (exp.includes('advanced')) return 'COMMERCIAL';
        return 'STUDENT';
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (error) {
            return 'Invalid Date';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.error = message;
        this.render();
    }

    // Mission actions
    async viewMission(id) {
        console.log('👁️ View mission:', id);
        try {
            const response = await fetch(`${this.apiBaseUrl}/missions/${id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch mission details');
            }
            const mission = await response.json();
            this.showMissionDetailModal(mission);
        } catch (error) {
            console.error('Error fetching mission:', error);
            alert('Failed to load mission details. Please try again.');
        }
    }

    async viewComments(id) {
        console.log('💬 View comments for mission:', id);
        try {
            const response = await fetch(`${this.apiBaseUrl}/missions/${id}/comments`);
            if (!response.ok) {
                throw new Error('Failed to fetch comments');
            }
            const data = await response.json();
            this.showCommentsModal(id, data.comments || []);
        } catch (error) {
            console.error('Error fetching comments:', error);
            alert('Failed to load comments. Please try again.');
        }
    }

    async markCompleted(id) {
        console.log('✓ Mark mission completed:', id);
        const pilotName = prompt('Enter your name to mark this mission as completed:');
        if (!pilotName || pilotName.trim() === '') {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/missions/${id}/completed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pilot_name: pilotName.trim(),
                    completion_date: new Date().toISOString().split('T')[0],
                    notes: ''
                })
            });

            if (!response.ok) {
                throw new Error('Failed to mark mission as completed');
            }

            alert(`Mission marked as completed! Great job, ${pilotName}!`);
            this.loadMissions(); // Refresh the mission list
        } catch (error) {
            console.error('Error marking mission completed:', error);
            alert('Failed to mark mission as completed. Please try again.');
        }
    }

    showMissionDetailModal(mission) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${this.escapeHtml(mission.title)}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="mission-detail">
                        <p><strong>Category:</strong> ${this.escapeHtml(mission.category)}</p>
                        <p><strong>Difficulty:</strong> ${this.getDifficultyLabel(mission.difficulty || 1)}</p>
                        <p><strong>Route:</strong> ${this.escapeHtml(mission.route || 'See description')}</p>
                        <p><strong>Objective:</strong> ${this.escapeHtml(mission.objective || mission.mission_description)}</p>
                        ${mission.description ? `<p><strong>Description:</strong> ${this.escapeHtml(mission.description)}</p>` : ''}
                        ${mission.notes ? `<p><strong>Notes:</strong> ${this.escapeHtml(mission.notes)}</p>` : ''}
                        ${mission.special_challenges ? `<p><strong>Special Challenges:</strong> ${this.escapeHtml(mission.special_challenges)}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showCommentsModal(missionId, comments) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        const commentsHtml = comments.length > 0
            ? comments.map(c => `
                <div class="comment">
                    <div class="comment-author">${this.escapeHtml(c.author_name)}</div>
                    <div class="comment-content">${this.escapeHtml(c.content)}</div>
                    <div class="comment-date">${new Date(c.created_at).toLocaleDateString()}</div>
                </div>
            `).join('')
            : '<p class="no-comments">No comments yet. Be the first to comment!</p>';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>💬 Comments</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="comments-list">
                        ${commentsHtml}
                    </div>
                    <div class="add-comment">
                        <h3>Add a Comment</h3>
                        <input type="text" id="comment-author" placeholder="Your name" class="form-input">
                        <textarea id="comment-content" placeholder="Your comment..." class="form-textarea" rows="4"></textarea>
                        <button class="btn-mission primary" onclick="app.submitComment(${missionId})">Post Comment</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async submitComment(missionId) {
        const author = document.getElementById('comment-author')?.value.trim();
        const content = document.getElementById('comment-content')?.value.trim();

        if (!author || !content) {
            alert('Please fill in both name and comment fields.');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/missions/${missionId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    author_name: author,
                    content: content
                })
            });

            if (!response.ok) {
                throw new Error('Failed to post comment');
            }

            // Close modal and refresh
            document.querySelector('.modal-overlay')?.remove();
            alert('Comment posted successfully!');
            this.loadMissions(); // Refresh to show updated comment count
        } catch (error) {
            console.error('Error posting comment:', error);
            alert('Failed to post comment. Please try again.');
        }
    }

    editMission(id) {
        console.log('✏️ Edit mission:', id);
        // TODO: Implement mission editing
    }

    async deleteMission(id) {
        if (!confirm('Are you sure you want to delete this mission?')) {
            return;
        }

        console.log('🗑️ Delete mission:', id);

        try {
            const response = await fetch(`${this.apiBaseUrl}/missions/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('✅ Mission deleted successfully');
            await this.loadMissions(); // Reload the list
        } catch (error) {
            console.error('❌ Failed to delete mission:', error);
            alert('Failed to delete mission: ' + error.message);
        }
    }

    showNewMissionForm() {
        console.log('➕ Show new mission form');

        const modalHTML = `
            <div class="modal-overlay" id="missionFormModal">
                <div class="modal-content mission-form-modal">
                    <div class="modal-header">
                        <h2>✈️ Create New Mission</h2>
                        <button class="modal-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <form id="newMissionForm" class="mission-form">
                        <div class="form-section">
                            <h3>Basic Information</h3>

                            <div class="form-group">
                                <label for="title">Mission Title *</label>
                                <input type="text" id="title" name="title" required maxlength="255"
                                    placeholder="e.g., Class B Ops: LAX Bravo Transition">
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="category">Category *</label>
                                    <select id="category" name="category" required>
                                        <option value="">Select a category</option>
                                        <option value="Training">Training</option>
                                        <option value="Proficiency">Proficiency</option>
                                        <option value="Cross-Country">Cross-Country</option>
                                        <option value="Emergency">Emergency</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="difficulty">Difficulty (1-10) *</label>
                                    <input type="number" id="difficulty" name="difficulty" required
                                        min="1" max="10" placeholder="1-10">
                                </div>

                <div class="form-group">
                                    <label for="pilot_experience">Pilot Experience</label>
                                    <select id="pilot_experience" name="pilot_experience">
                                        <option value="">Not specified</option>
                                        <option value="Beginner (< 100 hours)">Beginner (< 100 hours)</option>
                                        <option value="Intermediate (100-500 hours)">Intermediate (100-500 hours)</option>
                                        <option value="Advanced (500+ hours)">Advanced (500+ hours)</option>
                                        <option value="Commercial/ATP">Commercial/ATP</option>
                                    </select>
                </div>
                            </div>
                        </div>

                        <div class="form-section">
                            <h3>Mission Details</h3>

                <div class="form-group">
                                <label for="objective">Learning Objective *</label>
                                <textarea id="objective" name="objective" required rows="2"
                                    placeholder="Primary learning objective for this mission"></textarea>
                </div>

                            <div class="form-group">
                                <label for="mission_description">Mission Description *</label>
                                <textarea id="mission_description" name="mission_description" required rows="4"
                                    placeholder="Detailed description of what the pilot will do"></textarea>
                </div>

                            <div class="form-group">
                                <label for="why_description">Why This Mission? *</label>
                                <textarea id="why_description" name="why_description" required rows="3"
                                    placeholder="Educational rationale - why this mission is valuable"></textarea>
                            </div>
                        </div>

                        <div class="form-section">
                            <h3>Route Information</h3>

                <div class="form-group">
                                <label for="route">Route Description</label>
                                <input type="text" id="route" name="route" maxlength="500"
                                    placeholder="e.g., KPAO → coastal route south → LAX Bravo → KTOA">
                </div>

                <div class="form-group">
                                <label for="suggested_route">Suggested Waypoints</label>
                                <input type="text" id="suggested_route" name="suggested_route" maxlength="500"
                                    placeholder="e.g., KPAO KWVI KHHR KTOA">
                                <small>Use ICAO airport codes separated by spaces</small>
                </div>
                        </div>

                        <div class="form-section">
                            <h3>Additional Information</h3>

                <div class="form-group">
                                <label for="special_challenges">Special Challenges</label>
                                <input type="text" id="special_challenges" name="special_challenges"
                                    placeholder="e.g., Mountain Flying, High Altitude, Night Operations">
                </div>

                            <div class="form-group">
                                <label for="notes">Notes & Tips</label>
                                <textarea id="notes" name="notes" rows="3"
                                    placeholder="Additional notes, tips, and considerations for pilots"></textarea>
                            </div>
                        </div>

                <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Mission</button>
                </div>
            </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const form = document.getElementById('newMissionForm');
        form.addEventListener('submit', (e) => this.handleMissionSubmit(e));
    }

    closeModal() {
        const modal = document.getElementById('missionFormModal');
        if (modal) {
            modal.remove();
        }
    }

    async handleMissionSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);

        // Build mission object
        const mission = {
            title: formData.get('title'),
            category: formData.get('category'),
            difficulty: parseInt(formData.get('difficulty')),
            objective: formData.get('objective'),
            mission_description: formData.get('mission_description'),
            why_description: formData.get('why_description'),
            route: formData.get('route') || null,
            suggested_route: formData.get('suggested_route') || null,
            pilot_experience: formData.get('pilot_experience') || null,
            special_challenges: formData.get('special_challenges') || null,
            notes: formData.get('notes') || null
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/missions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mission)
            });

            if (!response.ok) {
                throw new Error(`Failed to create mission: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Mission created:', result);

            // Close modal and reload missions
                this.closeModal();
            await this.loadMissions();
            this.render();

            alert('Mission created successfully!');
        } catch (error) {
            console.error('❌ Failed to create mission:', error);
            alert('Failed to create mission: ' + error.message);
        }
    }

    showAdminLogin() {
        console.log('🔐 Show admin login');

        const modalHTML = `
            <div class="modal-overlay" id="adminLoginModal">
                <div class="modal-content admin-login-modal">
                    <div class="modal-header">
                        <h2>🔐 Admin Login</h2>
                        <button class="modal-close" onclick="app.closeAdminModal()">&times;</button>
                    </div>
                    <form id="adminLoginForm" class="admin-login-form">
                        <div class="form-group">
                            <label for="admin_name">Username</label>
                            <input type="text" id="admin_name" name="admin_name" required 
                                placeholder="Enter admin username" autocomplete="username">
                        </div>

                        <div class="form-group">
                            <label for="password">Password</label>
                            <input type="password" id="password" name="password" required 
                                placeholder="Enter password" autocomplete="current-password">
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="app.closeAdminModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Login</button>
                        </div>

                        <div id="loginError" class="login-error" style="display: none;"></div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const form = document.getElementById('adminLoginForm');
        form.addEventListener('submit', (e) => this.handleAdminLogin(e));
    }

    closeAdminModal() {
        const modal = document.getElementById('adminLoginModal');
        if (modal) {
            modal.remove();
        }
    }

    async handleAdminLogin(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const credentials = {
            admin_name: formData.get('admin_name'),
            password: formData.get('password')
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const errorDiv = document.getElementById('loginError');
        
        // Disable submit button during request
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        errorDiv.style.display = 'none';

        try {
            const response = await fetch(`${this.apiBaseUrl}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Login failed');
            }

            const result = await response.json();
            console.log('✅ Admin logged in:', result.admin_name);

            // Store the token
            localStorage.setItem('admin_token', result.token);
            localStorage.setItem('admin_name', result.admin_name);

            // Close modal
            this.closeAdminModal();

            // Update UI to show admin status
            this.updateAdminUI(true, result.admin_name);

            alert(`Welcome, ${result.admin_name}! You are now logged in as admin.`);
        } catch (error) {
            console.error('❌ Admin login failed:', error);
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }

    updateAdminUI(isAdmin, adminName = null) {
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) return;

        if (isAdmin && adminName) {
            headerActions.innerHTML = `
                <span class="admin-status">👤 Admin: ${this.escapeHtml(adminName)}</span>
                <button class="btn btn-primary" onclick="app.showNewMissionForm()">Create Mission</button>
                <button class="btn btn-secondary" onclick="app.handleAdminLogout()">Logout</button>
            `;
            } else {
            headerActions.innerHTML = `
                <button class="btn btn-primary" onclick="app.showNewMissionForm()">Create Mission</button>
                <button class="btn btn-secondary" onclick="app.showAdminLogin()">Admin Login</button>
            `;
        }
    }

    handleAdminLogout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_name');
            this.updateAdminUI(false);
            console.log('👋 Admin logged out');
            alert('You have been logged out.');
        }
    }

    async checkAdminStatus() {
        const token = localStorage.getItem('admin_token');
        const adminName = localStorage.getItem('admin_name');

        if (!token) {
            this.updateAdminUI(false);
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/admin/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.is_admin) {
                    this.updateAdminUI(true, adminName || result.admin_name);
                    console.log('✅ Admin session validated');
                    return;
                }
            }

            // Token invalid, clear it
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_name');
            this.updateAdminUI(false);
        } catch (error) {
            console.error('Failed to check admin status:', error);
            this.updateAdminUI(false);
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 DOM loaded, initializing Aviation Mission App...');
    window.app = new AviationMissionApp();
});