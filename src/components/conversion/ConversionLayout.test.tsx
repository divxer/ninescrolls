import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConversionCard, ConversionHero, FormSection, TrustSignalList } from './ConversionLayout';

describe('conversion layout primitives', () => {
  it('renders a conversion hero with actions and trust signals', () => {
    render(
      <MemoryRouter>
        <ConversionHero
          eyebrow="Engineering Support"
          title="Talk to a NineScrolls engineer"
          copy="Get help with process fit, configuration, and procurement."
          primaryAction={{ label: 'Request Quote', href: '/request-quote' }}
          secondaryAction={{ label: 'Contact Support', href: '/contact?topic=service' }}
          trustItems={['San Diego based', 'Engineering review', 'NDA available']}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Talk to a NineScrolls engineer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote');
    expect(screen.getByText('San Diego based')).toBeInTheDocument();
  });

  it('renders form sections with accessible headings', () => {
    render(
      <FormSection title="Contact information" description="Tell us who should receive the quote.">
        <label htmlFor="test-field">Email</label>
        <input id="test-field" />
      </FormSection>,
    );

    expect(screen.getByRole('heading', { name: 'Contact information' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders trust signal lists and cards without requiring page-specific logic', () => {
    render(
      <ConversionCard>
        <TrustSignalList items={[{ title: 'Secure payment' }, { title: 'Formal invoice available', copy: 'For procurement workflows.' }]} />
      </ConversionCard>,
    );

    expect(screen.getByText('Secure payment')).toBeInTheDocument();
    expect(screen.getByText('Formal invoice available')).toBeInTheDocument();
  });

  it('renders trust signal lists with readable dark-surface text', () => {
    render(
      <TrustSignalList
        variant="dark"
        items={[{ title: 'Process-first guidance', copy: 'Start with materials and process windows.' }]}
      />,
    );

    expect(screen.getByText('Process-first guidance')).toHaveClass('text-white');
    expect(screen.getByText('Start with materials and process windows.')).toHaveClass('text-slate-300');
  });
});
