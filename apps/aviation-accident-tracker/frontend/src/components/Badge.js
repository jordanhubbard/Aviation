import { jsx as _jsx } from "react/jsx-runtime";
export function Badge({ children, color = '#e0e0e0', border = '#bdbdbd' }) {
    return (_jsx("span", { style: {
            padding: '2px 6px',
            borderRadius: 4,
            background: color,
            border: `1px solid ${border}`,
            fontSize: 12,
        }, children: children }));
}
