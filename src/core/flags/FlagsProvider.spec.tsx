import { render, renderHook, screen } from '@testing-library/react';

import { FlagsProvider, useFlag, useFlags } from './FlagsProvider';
import { DEFAULT_FLAGS } from './registry';

const InterviewAssistant = () => (
  <p>{`interviewAssistant=${String(useFlag('interviewAssistant'))}`}</p>
);

describe('FlagsProvider', () => {
  it('uses the code defaults without a provider', () => {
    render(<InterviewAssistant />);

    expect(screen.getByText('interviewAssistant=false')).toBeInTheDocument();
    expect(renderHook(() => useFlags()).result.current).toEqual(DEFAULT_FLAGS);
  });

  it('gives every flag its code default (there is no remote source yet)', () => {
    const { result } = renderHook(() => useFlags(), { wrapper: FlagsProvider });

    expect(result.current).toEqual(DEFAULT_FLAGS);
    expect(result.current).toEqual({
      smartInspection: false,
      interviewAssistant: false,
      aiDiagnostics: false,
    });
  });

  it('answers for one flag with useFlag', () => {
    render(
      <FlagsProvider>
        <InterviewAssistant />
      </FlagsProvider>,
    );

    expect(screen.getByText('interviewAssistant=false')).toBeInTheDocument();
  });
});
