// Feedback panel component for bug reports and feature requests
class FeedbackPanel {
    constructor() {
        this.isVisible = false;
        this.isBugReport = true; // true for bug report, false for feature request
        this.panel = null;
        this.overlay = null;
        this.webhook = 'https://discord.com/api/webhooks/1313174668378771568/MESzfXqFIZVhUQKK70EavPTDTV6iW8ZuW6yPlAUi1ugPYU7tZm9-pThCZy9rF-VPwQeY';
    }

    createPanel() {
        // Create overlay
        this.overlay = GlifUtils.dom.createElement('div', {
            className: 'glif-overlay'
        });
        document.body.appendChild(this.overlay);

        // Create panel
        const panel = GlifUtils.dom.createElement('div', {
            className: 'glif-feedback-panel'
        });

        const header = GlifUtils.dom.createElement('div', {
            className: 'glif-feedback-header',
            innerHTML: `
                <h2>Submit Feedback</h2>
                <button class="glif-close-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `
        });

        const typeSwitch = GlifUtils.dom.createElement('div', {
            className: 'glif-type-switch',
            innerHTML: `
                <button class="active" data-type="bug">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M10.8 14.5l1.2-1.2M14.5 10.8l1.2-1.2"/>
                    </svg>
                    Bug Report
                </button>
                <button data-type="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                    Feature Request
                </button>
            `
        });

        const form = GlifUtils.dom.createElement('form', {
            className: 'glif-feedback-form',
            innerHTML: `
                <div class="glif-form-group">
                    <label for="feedback-title">Title</label>
                    <input type="text" id="feedback-title" placeholder="Brief description of the issue/feature" required>
                </div>
                <div class="glif-form-group">
                    <label for="feedback-description">Description</label>
                    <textarea id="feedback-description" rows="5" placeholder="Detailed description..." required></textarea>
                </div>
                <button type="submit" class="glif-submit-button">Submit</button>
            `
        });

        // Event Listeners
        header.querySelector('.glif-close-button').addEventListener('click', () => this.hidePanel());
        
        // Close on overlay click
        this.overlay.addEventListener('click', () => this.hidePanel());

        // Prevent panel clicks from closing
        panel.addEventListener('click', (e) => e.stopPropagation());

        typeSwitch.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                typeSwitch.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                this.isBugReport = button.dataset.type === 'bug';
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = form.querySelector('#feedback-title').value;
            const description = form.querySelector('#feedback-description').value;
            
            if (!title || !description) return;

            const type = this.isBugReport ? 'Bug Report' : 'Feature Request';
            const color = this.isBugReport ? 15548997 : 5793266; // Red for bugs, Green for features

            try {
                const response = await fetch(this.webhook, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        embeds: [{
                            title: `New ${type}`,
                            color: color,
                            fields: [
                                {
                                    name: 'Title',
                                    value: title
                                },
                                {
                                    name: 'Description',
                                    value: description
                                }
                            ],
                            timestamp: new Date().toISOString()
                        }]
                    })
                });

                if (response.ok) {
                    form.reset();
                    this.hidePanel();
                    // Show success message
                    const successMsg = GlifUtils.dom.createElement('div', {
                        className: 'glif-success-toast',
                        textContent: 'Feedback submitted successfully!'
                    });
                    document.body.appendChild(successMsg);
                    setTimeout(() => successMsg.remove(), 3000);
                }
            } catch (error) {
                console.error('Error submitting feedback:', error);
            }
        });

        panel.appendChild(header);
        panel.appendChild(typeSwitch);
        panel.appendChild(form);

        this.panel = panel;
        document.body.appendChild(panel);
    }

    showPanel() {
        if (!this.panel) {
            this.createPanel();
        }
        this.panel.classList.add('visible');
        this.overlay.classList.add('visible');
        this.isVisible = true;
    }

    hidePanel() {
        if (this.panel) {
            this.panel.classList.remove('visible');
            this.overlay.classList.remove('visible');
            this.isVisible = false;
        }
    }
}

// Export for use in other files
window.feedbackPanel = new FeedbackPanel();
