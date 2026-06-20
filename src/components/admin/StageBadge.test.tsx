import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StageBadge, CustomsBadge } from './StageBadge';

describe('StageBadge', () => {
  it('renders the stage label', () => {
    render(<StageBadge stage="IMPORT_CUSTOMS" />);
    expect(screen.getByText('Import Customs')).toBeInTheDocument();
  });
});

describe('CustomsBadge', () => {
  it('renders the customs status label', () => {
    render(<CustomsBadge status="RELEASED" />);
    expect(screen.getByText('Released')).toBeInTheDocument();
  });

  it('renders nothing for nullish status', () => {
    const { container } = render(<CustomsBadge status={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
