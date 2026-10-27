import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateStoreSettings } from '@/features/stores/stores-api';
import { ApiError } from '@/lib/api-client';
import { HoldingCostRateForm } from './HoldingCostRateForm';

vi.mock('@/features/stores/stores-api', () => ({ updateStoreSettings: vi.fn() }));
const updateSettings = vi.mocked(updateStoreSettings);

function renderForm(rate = 0.02) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HoldingCostRateForm storeId="s1" rate={rate} />
    </QueryClientProvider>,
  );
  return {
    field: screen.getByLabelText('Holding cost per month'),
    save: screen.getByRole('button', { name: 'Save' }),
  };
}

beforeEach(() => {
  updateSettings.mockReset();
});

describe('HoldingCostRateForm', () => {
  it('shows the saved rate as a percent', () => {
    expect(renderForm(0.035).field).toHaveValue('3.5');
  });

  it('keeps Save disabled until the value differs from the saved one', async () => {
    const { field, save } = renderForm();
    expect(save).toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, '3');
    expect(save).toBeEnabled();

    await userEvent.clear(field);
    await userEvent.type(field, '2');
    expect(save).toBeDisabled();
  });

  it.each([
    ['3.5', 0.035],
    ['3,5', 0.035],
    ['3.5%', 0.035],
    ['0', 0],
  ])('saves "%s" as the fraction %d and confirms it', async (typed, rate) => {
    updateSettings.mockResolvedValue({ settings: { holdingCostRate: rate } });
    const { field, save } = renderForm();

    await userEvent.clear(field);
    await userEvent.type(field, typed);
    await userEvent.click(save);

    expect(updateSettings).toHaveBeenCalledWith('s1', { holdingCostRate: rate });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it.each(['abc', '101', '2.555', ''])(
    'rejects "%s" next to the field without calling the server',
    async (typed) => {
      const { field, save } = renderForm();

      await userEvent.clear(field);
      if (typed) await userEvent.type(field, typed);
      await userEvent.click(save);

      expect(await screen.findByRole('alert')).toHaveTextContent(/from 0 to 100/);
      expect(field).toBeInvalid();
      expect(updateSettings).not.toHaveBeenCalled();
    },
  );

  it('clears the error as soon as the value is edited', async () => {
    const { field, save } = renderForm();
    await userEvent.clear(field);
    await userEvent.type(field, 'abc');
    await userEvent.click(save);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.type(field, '1');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server message when saving fails, and no "Saved"', async () => {
    updateSettings.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Database is down'));
    const { field, save } = renderForm();

    await userEvent.clear(field);
    await userEvent.type(field, '3');
    await userEvent.click(save);

    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down');
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
