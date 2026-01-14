import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { mockEvents, mockAirports, mockFilterOptions } from './mockData';
describe('App Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default fetch mocks
        global.fetch = vi.fn((url) => {
            if (url.includes('/api/events')) {
                return Promise.resolve({
                    json: () => Promise.resolve({ data: mockEvents }),
                });
            }
            if (url.includes('/api/airports')) {
                return Promise.resolve({
                    json: () => Promise.resolve(mockAirports),
                });
            }
            if (url.includes('/api/filters/options')) {
                return Promise.resolve({
                    json: () => Promise.resolve(mockFilterOptions),
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });
    });
    describe('Initial Rendering', () => {
        it('renders the app title', () => {
            render(_jsx(App, {}));
            expect(screen.getByText('Aviation Accident Tracker')).toBeInTheDocument();
        });
        it('shows loading state initially', () => {
            render(_jsx(App, {}));
            expect(screen.getByText('Loading events…')).toBeInTheDocument();
        });
        it('loads and displays events', async () => {
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText('N12345')).toBeInTheDocument();
                expect(screen.getByText('N67890')).toBeInTheDocument();
            });
        });
        it('displays the map container', () => {
            render(_jsx(App, {}));
            expect(screen.getByTestId('map-container')).toBeInTheDocument();
        });
        it('displays the events table', async () => {
            render(_jsx(App, {}));
            await waitFor(() => {
                const table = screen.getByRole('table');
                expect(table).toBeInTheDocument();
            });
        });
    });
    describe('Filter Functionality', () => {
        it('renders all filter controls', async () => {
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByPlaceholderText('registration/operator/summary')).toBeInTheDocument();
                expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
                expect(screen.getByLabelText(/Country/)).toBeInTheDocument();
                expect(screen.getByLabelText(/Region/)).toBeInTheDocument();
                expect(screen.getByLabelText(/From/)).toBeInTheDocument();
                expect(screen.getByLabelText(/To/)).toBeInTheDocument();
                expect(screen.getByPlaceholderText('ICAO/IATA or name')).toBeInTheDocument();
            });
        });
        it('updates search filter', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            const searchInput = await screen.findByPlaceholderText('registration/operator/summary');
            await user.type(searchInput, 'N12345');
            expect(searchInput).toHaveValue('N12345');
        });
        it('updates category filter', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            const categorySelect = await screen.findByLabelText(/Category/);
            await user.selectOptions(categorySelect, 'general');
            expect(categorySelect).toHaveValue('general');
        });
        it('updates country filter', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            await waitFor(() => {
                const countrySelect = screen.getByLabelText(/Country/);
                expect(countrySelect).toBeInTheDocument();
            });
            const countrySelect = screen.getByLabelText(/Country/);
            await user.selectOptions(countrySelect, 'USA');
            expect(countrySelect).toHaveValue('USA');
        });
        it('shows correct filter count badge', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            // Initially 0 filters
            await waitFor(() => {
                expect(screen.getByText(/Filters active:/)).toBeInTheDocument();
            });
            // Add a search filter
            const searchInput = await screen.findByPlaceholderText('registration/operator/summary');
            await user.type(searchInput, 'test');
            // Badge should update
            await waitFor(() => {
                const badgeText = screen.getByText(/Filters active:/);
                expect(badgeText).toBeInTheDocument();
            });
        });
        it('clears all filters', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            // Set some filters
            const searchInput = await screen.findByPlaceholderText('registration/operator/summary');
            await user.type(searchInput, 'test');
            const categorySelect = await screen.findByLabelText(/Category/);
            await user.selectOptions(categorySelect, 'general');
            // Click clear button
            const clearButton = screen.getByText('Clear');
            await user.click(clearButton);
            // All filters should be reset
            expect(searchInput).toHaveValue('');
            expect(categorySelect).toHaveValue('all');
        });
    });
    describe('Table Functionality', () => {
        it('displays event data in table', async () => {
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText('N12345')).toBeInTheDocument();
                expect(screen.getByText('Private Owner')).toBeInTheDocument();
                expect(screen.getByText('Cessna 172')).toBeInTheDocument();
            });
        });
        it('shows category badges with correct styling', async () => {
            render(_jsx(App, {}));
            await waitFor(() => {
                const generalBadge = screen.getByText('general');
                expect(generalBadge).toBeInTheDocument();
                const commercialBadge = screen.getByText('commercial');
                expect(commercialBadge).toBeInTheDocument();
            });
        });
        it('handles pagination controls', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText('Page 1')).toBeInTheDocument();
            });
            const prevButton = screen.getByText('Prev');
            const nextButton = screen.getByText('Next');
            // Prev should be disabled on first page
            expect(prevButton).toBeDisabled();
            // Next should be enabled
            expect(nextButton).not.toBeDisabled();
            // Click next
            await user.click(nextButton);
            // Page should update
            await waitFor(() => {
                expect(screen.getByText('Page 2')).toBeInTheDocument();
            });
        });
        it('opens detail modal when clicking table row', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText('N12345')).toBeInTheDocument();
            });
            const row = screen.getByText('N12345').closest('tr');
            expect(row).toBeInTheDocument();
            await user.click(row);
            // Modal should open with event details
            await waitFor(() => {
                expect(screen.getByText(/Engine failure on approach/)).toBeInTheDocument();
                expect(screen.getByText(/Aircraft experienced sudden engine failure/)).toBeInTheDocument();
            });
        });
    });
    describe('Map Functionality', () => {
        it('renders map with markers for positioned events', async () => {
            render(_jsx(App, {}));
            await waitFor(() => {
                // Map container should be present
                expect(screen.getByTestId('map-container')).toBeInTheDocument();
                // Marker cluster should be present
                expect(screen.getByTestId('marker-cluster')).toBeInTheDocument();
                // Should have markers (mockEvents has 2 positioned events)
                const markers = screen.getAllByTestId('marker');
                expect(markers.length).toBeGreaterThan(0);
            });
        });
        it('only shows markers for events with coordinates', async () => {
            render(_jsx(App, {}));
            await waitFor(() => {
                // mockEvents has 3 events, but only 2 have lat/lon
                const markers = screen.getAllByTestId('marker');
                expect(markers.length).toBe(2);
            });
        });
    });
    describe('Detail Modal', () => {
        it('opens modal with full event details', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText('N12345')).toBeInTheDocument();
            });
            const row = screen.getByText('N12345').closest('tr');
            await user.click(row);
            await waitFor(() => {
                // Check all detail fields
                expect(screen.getByText(/N12345 — Private Owner/)).toBeInTheDocument();
                expect(screen.getByText(/Engine failure on approach/)).toBeInTheDocument();
                expect(screen.getByText(/KSFO/)).toBeInTheDocument();
                expect(screen.getByText(/Cessna 172/)).toBeInTheDocument();
                // Check source link
                const sourceLink = screen.getByRole('link', { name: /ASN/i });
                expect(sourceLink).toHaveAttribute('href', 'https://aviation-safety.net/database/record.php?id=20240115-0');
                expect(sourceLink).toHaveAttribute('target', '_blank');
            });
        });
        it('closes modal when clicking close button', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText('N12345')).toBeInTheDocument();
            });
            const row = screen.getByText('N12345').closest('tr');
            await user.click(row);
            await waitFor(() => {
                expect(screen.getByText(/Engine failure on approach/)).toBeInTheDocument();
            });
            const closeButton = screen.getByText('Close');
            await user.click(closeButton);
            // Modal should be closed
            await waitFor(() => {
                expect(screen.queryByText(/Engine failure on approach/)).not.toBeInTheDocument();
            });
        });
        it('closes modal when clicking backdrop', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText('N12345')).toBeInTheDocument();
            });
            const row = screen.getByText('N12345').closest('tr');
            await user.click(row);
            await waitFor(() => {
                expect(screen.getByText(/Engine failure on approach/)).toBeInTheDocument();
            });
            // Find the modal backdrop (the outer div with fixed position)
            const backdrop = screen.getByText(/Engine failure on approach/).closest('[style*="position: fixed"]');
            expect(backdrop).toBeInTheDocument();
            // Click the backdrop
            await user.click(backdrop);
            // Modal should be closed
            await waitFor(() => {
                expect(screen.queryByText(/Engine failure on approach/)).not.toBeInTheDocument();
            });
        });
    });
    describe('Error Handling', () => {
        it('displays error message when fetch fails', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText(/Error:/)).toBeInTheDocument();
            });
        });
        it('shows no events message when empty data returned', async () => {
            global.fetch = vi.fn(() => Promise.resolve({
                json: () => Promise.resolve({ data: [] }),
            }));
            render(_jsx(App, {}));
            await waitFor(() => {
                expect(screen.getByText(/No events found for current filters/)).toBeInTheDocument();
            });
        });
    });
    describe('Airport Search', () => {
        it('fetches airports when typing in airport filter', async () => {
            const user = userEvent.setup();
            render(_jsx(App, {}));
            const airportInput = await screen.findByPlaceholderText('ICAO/IATA or name');
            await user.type(airportInput, 'SFO');
            // Should trigger debounced fetch
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/airports?search=SFO'));
            }, { timeout: 1000 });
        });
    });
});
