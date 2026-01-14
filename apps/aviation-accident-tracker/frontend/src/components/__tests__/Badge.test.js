import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
describe('Badge Component', () => {
    it('renders children correctly', () => {
        render(_jsx(Badge, { children: "Test Badge" }));
        expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });
    it('applies default styling', () => {
        render(_jsx(Badge, { children: "Default" }));
        const badge = screen.getByText('Default');
        expect(badge).toHaveStyle({
            background: '#e0e0e0',
            borderRadius: '4px',
            fontSize: '12px',
        });
    });
    it('applies custom color', () => {
        render(_jsx(Badge, { color: "#ff0000", children: "Red Badge" }));
        const badge = screen.getByText('Red Badge');
        expect(badge).toHaveStyle({ background: '#ff0000' });
    });
    it('applies custom border', () => {
        render(_jsx(Badge, { border: "#0000ff", children: "Blue Border" }));
        const badge = screen.getByText('Blue Border');
        expect(badge).toHaveStyle({ border: '1px solid #0000ff' });
    });
    it('applies both custom color and border', () => {
        render(_jsx(Badge, { color: "#00ff00", border: "#ff00ff", children: "Custom Badge" }));
        const badge = screen.getByText('Custom Badge');
        expect(badge).toHaveStyle({
            background: '#00ff00',
            border: '1px solid #ff00ff',
        });
    });
    it('renders with multiple children elements', () => {
        render(_jsxs(Badge, { children: [_jsx("span", { children: "Part 1" }), _jsx("span", { children: "Part 2" })] }));
        expect(screen.getByText('Part 1')).toBeInTheDocument();
        expect(screen.getByText('Part 2')).toBeInTheDocument();
    });
    it('renders numeric children', () => {
        render(_jsx(Badge, { children: 42 }));
        expect(screen.getByText('42')).toBeInTheDocument();
    });
});
