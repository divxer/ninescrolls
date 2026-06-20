import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MilestoneProgress } from './MilestoneProgress';

describe('MilestoneProgress', () => {
  const enabled = ['PRODUCTION', 'FAT_PASSED', 'DELIVERED', 'CLOSED'] as const;

  it('renders only the enabled stages', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="FAT_PASSED" />);
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('FAT Passed')).toBeInTheDocument();
    expect(screen.queryByText('Testing')).not.toBeInTheDocument();
  });

  it('marks the current stage active via aria-current', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="FAT_PASSED" />);
    expect(screen.getByText('FAT Passed').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
  });

  it('shows DRAFT as the active leading pip when the case is at DRAFT', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="DRAFT" />);
    expect(screen.getByText('Draft').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders a standalone Cancelled state', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="CANCELLED" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Production')).not.toBeInTheDocument();
  });
});
