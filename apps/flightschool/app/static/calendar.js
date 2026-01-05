// Simple 7-day calendar widget for booking UI
// Renders a week view, allows navigation, and emits selected datetime

class WeekCalendar {
    constructor(containerId, onSelect, options = {}) {
        this.container = document.getElementById(containerId);
        this.onSelect = onSelect;
        this.selectedStart = null;
        this.selectedEnd = null;
        this.currentStart = this.getStartOfWeek(new Date());
        this.isDragging = false;
        // Booking block rendering support
        this.bookingBlocks = options.bookingBlocks || [];
        this.aircraftBlockColor = options.aircraftBlockColor || '#ffcccc';
        this.instructorBlockColor = options.instructorBlockColor || '#cce5ff';
        this.render();
    }

    getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - d.getDay()); // Sunday as first day
        return d;
    }

    addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    formatDate(date) {
        return date.toISOString().slice(0, 10);
    }

    formatDayHeader(date) {
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }

    overlaps(start1, end1, start2, end2) {
        return (start1 < end2 && start2 < end1);
    }

    render() {
        this.container.innerHTML = '';
        const nav = document.createElement('div');
        nav.className = 'calendar-nav mb-2';
        nav.innerHTML = `
            <button class="btn btn-sm btn-outline-secondary me-2" id="cal-prev">&lt; Prev</button>
            <span class="fw-bold">${this.formatDayHeader(this.currentStart)} - ${this.formatDayHeader(this.addDays(this.currentStart, 6))}</span>
            <button class="btn btn-sm btn-outline-secondary ms-2" id="cal-next">Next &gt;</button>
        `;
        this.container.appendChild(nav);

        const table = document.createElement('table');
        table.className = 'table table-bordered calendar-table';
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        for (let i = 0; i < 7; i++) {
            const d = this.addDays(this.currentStart, i);
            const th = document.createElement('th');
            th.textContent = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
            tr.appendChild(th);
        }
        thead.appendChild(tr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const slots = [];
        for (let slot = 8 * 2; slot <= 18 * 2; slot++) {
            const row = document.createElement('tr');
            for (let i = 0; i < 7; i++) {
                const d = this.addDays(this.currentStart, i);
                const hour = Math.floor(slot / 2);
                const min = (slot % 2) * 30;
                const slotTime = new Date(d);
                slotTime.setHours(hour, min, 0, 0);
                const td = document.createElement('td');
                td.className = 'calendar-cell';
                td.dataset.datetime = slotTime.toISOString();
                td.textContent = `${hour.toString().padStart(2, '0')}:${min === 0 ? '00' : '30'}`;
                td.style.cursor = 'pointer';
                slots.push({td, slotTime});
                // Highlight if in selection
                if (this.selectedStart && this.selectedEnd) {
                    const s = new Date(this.selectedStart).getTime();
                    const e = new Date(this.selectedEnd).getTime();
                    const t = slotTime.getTime();
                    if (t >= Math.min(s, e) && t <= Math.max(s, e)) {
                        td.classList.add('bg-primary', 'text-white');
                    }
                } else if (this.selectedStart && new Date(this.selectedStart).toISOString() === slotTime.toISOString()) {
                    td.classList.add('bg-primary', 'text-white');
                }
                // Highlight booking blocks
                if (this.bookingBlocks && this.bookingBlocks.length > 0) {
                    this.bookingBlocks.forEach(block => {
                        const blockStart = new Date(block.start);
                        const blockEnd = new Date(block.end);
                        // Aircraft block
                        if (block.aircraft_id && block.aircraft_id == document.getElementById('aircraft_id').value && this.overlaps(slotTime, new Date(slotTime.getTime()+30*60000), blockStart, blockEnd)) {
                            td.style.backgroundColor = this.aircraftBlockColor;
                        }
                        // Instructor block
                        if (block.instructor_id && block.instructor_id == document.getElementById('instructor_id').value && this.overlaps(slotTime, new Date(slotTime.getTime()+30*60000), blockStart, blockEnd)) {
                            td.style.backgroundColor = this.instructorBlockColor;
                        }
                    });
                }
                // Mouse events for drag selection
                td.onmousedown = (ev) => {
                    this.isDragging = true;
                    this.selectedStart = slotTime;
                    this.selectedEnd = slotTime;
                    this.render();
                };
                td.onmouseenter = (ev) => {
                    if (this.isDragging && this.selectedStart) {
                        this.selectedEnd = slotTime;
                        this.render();
                    }
                };
                td.onmouseup = (ev) => {
                    if (this.isDragging) {
                        this.isDragging = false;
                        if (this.onSelect && this.selectedStart && this.selectedEnd) {
                            let start = new Date(Math.min(this.selectedStart, this.selectedEnd));
                            let end = new Date(Math.max(this.selectedStart, this.selectedEnd));
                            this.onSelect(start, end);
                        }
                    }
                };
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        this.container.appendChild(table);
        document.getElementById('cal-prev').onclick = () => {
            this.currentStart = this.addDays(this.currentStart, -7);
            this.render();
        };
        document.getElementById('cal-next').onclick = () => {
            this.currentStart = this.addDays(this.currentStart, 7);
            this.render();
        };
        // Mouse up anywhere ends dragging
        document.onmouseup = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.render();
            }
        };
    }
}

// Expose to window for use in HTML
window.WeekCalendar = WeekCalendar;
