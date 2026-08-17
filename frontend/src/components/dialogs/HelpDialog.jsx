import { useState } from 'react';
import { useUIStore } from '@/store';
import { Modal, Button, Stack } from '@/components/ui';

const HELP_SECTIONS = [
  {
    id: 'getting-started',
    title: '🚀 Getting Started',
    content: `Welcome to EtherX Word! Here's how to get started:

1. Create a New Document
   • Click "File" → "New" or press Ctrl+N
   • Choose from templates or start blank
   • Your document auto-saves every 3 seconds

2. Basic Editing
   • Type directly into the page
   • Use Ctrl+B for bold, Ctrl+I for italic, Ctrl+U for underline
   • Format text using the Home tab ribbon

3. Document Structure
   • Add headings from the Home tab
   • Insert pages automatically when text overflows
   • View page thumbnails in the left sidebar

4. Save & Export
   • Documents auto-save to cloud
   • Export as PDF, Word (.docx), or HTML
   • Share documents with collaborators in real-time`
  },
  {
    id: 'collaboration',
    title: '👥 Real-Time Collaboration',
    content: `Work together seamlessly with EtherX Word:

1. Share Your Document
   • Click Share button in top right
   • Copy the share link
   • Collaborators join instantly - no sign up needed

2. Live Editing
   • See collaborators' cursors in real-time (colored by user)
   • Watch others type as they type
   • Comments and replies sync instantly

3. Review (Word-like)
   • Use Review actions (Track Changes / Comments)
   • See who made changes and when
   • Resolve items after approval

4. Comments & Feedback
   • Right-click or select text → Add Comment
   • Collaborators can reply to comments
   • Resolve comments when done addressing feedback`
  },
  {
    id: 'formatting',
    title: '✨ Formatting & Styling',
    content: `Master document formatting:

1. Text Formatting (Home Tab)
   • Font family, size, color, highlights
   • Bold, italic, underline, strikethrough
   • Superscript, subscript, small caps

2. Paragraphs
   • Alignment: left, center, right, justify
   • Indentation and spacing before/after
   • Line spacing options

3. Tables & Lists
   • Insert Tab → Table or List
   • Format table cells with colors
   • Create nested lists with Tab/Shift+Tab

4. Styles & Appearance
   • Pre-designed document styles
   • Consistent formatting across document
   • EtherX Word uses a focused dark interface`
  },
  {
    id: 'advanced',
    title: '🎯 Advanced Features',
    content: `Unlock powerful capabilities:

1. Headers & Footers
   • Insert Tab → Header/Footer
   • Add page numbers automatically
   • Different first page options

2. Bibliography & References
   • Reference Tab → Manage Sources
   • Insert citations in multiple formats
   • Auto-generate bibliography

3. Mail Merge
   • Mailings Tab → Select Recipients
   • Insert merge fields
   • Generate personalized documents

4. Drawing & Shapes
   • Draw Tab → Draw/Shapes
   • Add equations and formulas
   • Insert images with text wrapping

5. Find & Replace
   • Ctrl+H for Find & Replace
   • Use regular expressions for advanced search
   • Replace all with one click`
  },
  {
    id: 'view-options',
    title: '👁️ View & Display Options',
    content: `Customize your editing experience:

1. View Modes
   • Print Layout: traditional document view
   • Web Layout: optimized for web
   • Outline: structure view
   • Draft: minimal formatting
   • Read Mode: distraction-free viewing

2. Show/Hide Elements
   • Ruler: measurement guide on top
   • Gridlines: alignment grid
   • Navigation Pane: jump to sections
   • Fullscreen: maximize editing space

3. Zoom Controls
   • Status bar: zoom slider
   • View Tab: preset zoom levels
   • Ctrl+Mouse Wheel: quick zoom

4. Focus Mode
   • Hides ribbon for maximum space
   • Press Escape to exit
   • Perfect for distraction-free writing`
  },
  {
    id: 'keyboard-shortcuts',
    title: '⌨️ Keyboard Shortcuts',
    content: `Work faster with shortcuts:

Document
  • Ctrl+N: New document
  • Ctrl+O: Open document
  • Ctrl+S: Save document
  • Ctrl+W: Close document
  • Ctrl+P: Print

Editing
  • Ctrl+Z: Undo
  • Ctrl+Y: Redo
  • Ctrl+X: Cut
  • Ctrl+C: Copy
  • Ctrl+V: Paste
  • Ctrl+A: Select all
  • Ctrl+F: Find
  • Ctrl+H: Find & Replace

Formatting
  • Ctrl+B: Bold
  • Ctrl+I: Italic
  • Ctrl+U: Underline
  • Ctrl+Shift+X: Strikethrough
  • Ctrl+]: Increase font size
  • Ctrl+[: Decrease font size

Navigation
  • Ctrl+Home: Go to start
  • Ctrl+End: Go to end
  • Ctrl+G: Go to page
  • Page Up/Down: Scroll by page`
  }
];

export function HelpDialog() {
  const { closeDialog } = useUIStore();
  const [activeSection, setActiveSection] = useState('getting-started');
  const currentSection = HELP_SECTIONS.find((s) => s.id === activeSection);

  return (
    <Modal title="Help & Tutorials" onClose={() => closeDialog('help')} width={700}>
      <div style={{ display: 'flex', gap: '20px', maxHeight: '500px' }}>
        {/* Sidebar Navigation */}
        <div style={{
          minWidth: '180px',
          borderRight: '1px solid var(--border)',
          paddingRight: '16px',
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>
            Help Topics
          </div>
          <Stack gap={6}>
            {HELP_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                style={{
                  padding: '8px 12px',
                  background: activeSection === section.id ? 'var(--bg-active)' : 'transparent',
                  border: '1px solid ' + (activeSection === section.id ? 'var(--gold)' : 'transparent'),
                  borderRadius: 'var(--radius-sm)',
                  color: activeSection === section.id ? 'var(--gold)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== section.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {section.title.split(' ').slice(1).join(' ')}
              </button>
            ))}
          </Stack>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 12,
            fontFamily: 'var(--font-ui)',
          }}>
            {currentSection?.title}
          </div>
          <div style={{
            fontSize: 13,
            lineHeight: '1.6',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-ui)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {currentSection?.content}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="subtle" onClick={() => closeDialog('help')}>Close</Button>
      </div>
    </Modal>
  );
}
