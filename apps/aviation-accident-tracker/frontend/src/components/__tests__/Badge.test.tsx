import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge Component', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('applies default styling', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveStyle({
      background: '#e0e0e0',
      borderRadius: '4px',
      fontSize: '12px',
    });
  });

  it('applies custom color', () => {
    render(<Badge color="#ff0000">Red Badge</Badge>);
    const badge = screen.getByText('Red Badge');
    expect(badge).toHaveStyle({ background: '#ff0000' });
  });

  it('applies custom border', () => {
    render(<Badge border="#0000ff">Blue Border</Badge>);
    const badge = screen.getByText('Blue Border');
    expect(badge).toHaveStyle({ borderColor: '#0000ff', borderStyle: 'solid', borderWidth: '1px' });
  });

  it('applies both custom color and border', () => {
    render(
      <Badge color="#00ff00" border="#ff00ff">
        Custom Badge
      </Badge>
    );
    const badge = screen.getByText('Custom Badge');
    expect(badge).toHaveStyle({
      background: '#00ff00',
      borderColor: '#ff00ff',
      borderStyle: 'solid',
      borderWidth: '1px',
    });
  });

  it('renders with multiple children elements', () => {
    render(
      <Badge>
        <span>Part 1</span>
        <span>Part 2</span>
      </Badge>
    );
    expect(screen.getByText('Part 1')).toBeInTheDocument();
    expect(screen.getByText('Part 2')).toBeInTheDocument();
  });

  it('renders numeric children', () => {
    render(<Badge>{42}</Badge>);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
