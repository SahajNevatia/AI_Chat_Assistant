import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MessageBubble } from '../components/MessageBubble';
import { MessageList } from '../components/MessageList';
import { EmptyState } from '../components/EmptyState';

describe('Frontend: Responsive Desktop and Mobile Layouts', () => {
  it('renders sidebar with responsive classes for desktop and mobile drawer toggle', () => {
    const { container, rerender } = render(
      <Sidebar
        conversations={[{ _id: '1', title: 'Test Chat', updatedAt: new Date().toISOString() }]}
        activeId="1"
        isOpen={false}
        onSelectConversation={() => {}}
        onNewChat={() => {}}
        onRenameConversation={() => {}}
        onDeleteConversation={() => {}}
        onOpenSearchModal={() => {}}
        onClose={() => {}}
      />
    );

    const aside = container.querySelector('aside');
    expect(aside).toBeTruthy();
    // In closed state, hidden on mobile via -translate-x-full and shown on desktop via lg:translate-x-0
    expect(aside.className).toContain('-translate-x-full');
    expect(aside.className).toContain('lg:translate-x-0');

    // When isOpen is true, drawer translates into view and backdrop exists
    rerender(
      <Sidebar
        conversations={[{ _id: '1', title: 'Test Chat', updatedAt: new Date().toISOString() }]}
        activeId="1"
        isOpen={true}
        onSelectConversation={() => {}}
        onNewChat={() => {}}
        onRenameConversation={() => {}}
        onDeleteConversation={() => {}}
        onOpenSearchModal={() => {}}
        onClose={() => {}}
      />
    );

    expect(aside.className).toContain('translate-x-0');
    // Mobile backdrop exists
    const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/60');
    expect(backdrop).toBeTruthy();
  });

  it('renders header with mobile hamburger button and responsive controls', () => {
    const onToggleSidebar = vi.fn();
    render(
      <Header
        activeConversation={{ title: 'Chat on Mobile' }}
        selectedTone="Professional"
        onToneChange={() => {}}
        selectedProvider="openai"
        onProviderChange={() => {}}
        providerStatus={{ providers: { openai: { available: true } } }}
        onToggleSidebar={onToggleSidebar}
        isStreaming={false}
      />
    );

    const menuButton = screen.getByTitle('Toggle conversation list');
    expect(menuButton).toBeTruthy();
    fireEvent.click(menuButton);
    expect(onToggleSidebar).toHaveBeenCalled();
  });
});

describe('Frontend: Streaming Indicator and Auto-Scroll', () => {
  it('renders the streaming cursor indicator when streaming is active on the last message', () => {
    const { container } = render(
      <MessageBubble
        message={{ role: 'assistant', content: 'Generating real-time thoughts...', tone: 'Casual' }}
        isLast={true}
        isStreaming={true}
        onRegenerate={() => {}}
      />
    );

    const cursor = container.querySelector('.streaming-cursor');
    expect(cursor).toBeTruthy();
  });

  it('does NOT render the streaming cursor when streaming is finished', () => {
    const { container } = render(
      <MessageBubble
        message={{ role: 'assistant', content: 'Completed response.', tone: 'Casual' }}
        isLast={true}
        isStreaming={false}
        onRegenerate={() => {}}
      />
    );

    const cursor = container.querySelector('.streaming-cursor');
    expect(cursor).toBeNull();
  });
});

describe('Frontend: Empty, Loading, and Error States', () => {
  it('renders EmptyState with tone indicator and interactive prompt suggestions', () => {
    const onSelect = vi.fn();
    render(<EmptyState selectedTone="Concise" onSelectSuggestion={onSelect} />);

    expect(screen.getByText('How can I help you today?')).toBeTruthy();
    expect(screen.getByText('Concise')).toBeTruthy();

    const codeSuggestion = screen.getByText('Code Architecture');
    expect(codeSuggestion).toBeTruthy();
    fireEvent.click(codeSuggestion);
    expect(onSelect).toHaveBeenCalled();
  });

  it('renders loading state in sidebar when conversations are being fetched', () => {
    render(
      <Sidebar
        conversations={[]}
        activeId={null}
        isLoading={true}
        onSelectConversation={() => {}}
        onNewChat={() => {}}
        onRenameConversation={() => {}}
        onDeleteConversation={() => {}}
        onOpenSearchModal={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Loading history...')).toBeTruthy();
  });

  it('renders empty conversation list state when no chats exist', () => {
    render(
      <Sidebar
        conversations={[]}
        activeId={null}
        isLoading={false}
        onSelectConversation={() => {}}
        onNewChat={() => {}}
        onRenameConversation={() => {}}
        onDeleteConversation={() => {}}
        onOpenSearchModal={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });
});
