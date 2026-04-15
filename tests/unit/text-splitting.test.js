/**
 * Unit tests for splitTextIntoWords() and splitTextIntoChars()
 * Source: js/main.js lines 12–47
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Re-implement the functions here so we can test them in isolation
// without loading GSAP, Lenis, and the entire main.js side effects.

function splitTextIntoWords(el) {
  const text = el.textContent.trim();
  const words = text.split(/\s+/);
  el.innerHTML = '';
  el.setAttribute('aria-label', text);
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.style.display = 'inline-block';
    span.style.overflow = 'hidden';
    const inner = document.createElement('span');
    inner.className = 'word-inner';
    inner.style.display = 'inline-block';
    inner.textContent = word;
    span.appendChild(inner);
    el.appendChild(span);
    if (i < words.length - 1) {
      el.appendChild(document.createTextNode(' '));
    }
  });
  return el.querySelectorAll('.word-inner');
}

function splitTextIntoChars(el) {
  const text = el.textContent.trim();
  el.innerHTML = '';
  el.setAttribute('aria-label', text);
  [...text].forEach(char => {
    const span = document.createElement('span');
    span.className = 'char';
    span.style.display = 'inline-block';
    span.textContent = char === ' ' ? '\u00A0' : char;
    el.appendChild(span);
  });
  return el.querySelectorAll('.char');
}

describe('splitTextIntoWords', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('h1');
  });

  it('splits a simple sentence into word spans', () => {
    el.textContent = 'Hello World';
    const words = splitTextIntoWords(el);
    expect(words.length).toBe(2);
    expect(words[0].textContent).toBe('Hello');
    expect(words[1].textContent).toBe('World');
  });

  it('sets aria-label to the original text', () => {
    el.textContent = 'Premium Creative Agency';
    splitTextIntoWords(el);
    expect(el.getAttribute('aria-label')).toBe('Premium Creative Agency');
  });

  it('wraps each word in a .word > .word-inner structure', () => {
    el.textContent = 'Sircle Agency';
    splitTextIntoWords(el);
    const outerSpans = el.querySelectorAll('.word');
    expect(outerSpans.length).toBe(2);
    outerSpans.forEach(span => {
      expect(span.style.display).toBe('inline-block');
      expect(span.style.overflow).toBe('hidden');
      const inner = span.querySelector('.word-inner');
      expect(inner).not.toBeNull();
      expect(inner.style.display).toBe('inline-block');
    });
  });

  it('inserts text node spaces between words', () => {
    el.textContent = 'One Two Three';
    splitTextIntoWords(el);
    // childNodes: span, text(' '), span, text(' '), span
    const nodes = [...el.childNodes];
    expect(nodes.length).toBe(5);
    expect(nodes[1].nodeType).toBe(Node.TEXT_NODE);
    expect(nodes[1].textContent).toBe(' ');
    expect(nodes[3].nodeType).toBe(Node.TEXT_NODE);
    expect(nodes[3].textContent).toBe(' ');
  });

  it('does not add trailing space after the last word', () => {
    el.textContent = 'Last Word';
    splitTextIntoWords(el);
    const lastNode = el.childNodes[el.childNodes.length - 1];
    expect(lastNode.nodeType).toBe(Node.ELEMENT_NODE); // span, not text
  });

  it('handles a single word', () => {
    el.textContent = 'Agency';
    const words = splitTextIntoWords(el);
    expect(words.length).toBe(1);
    expect(words[0].textContent).toBe('Agency');
    // Only one span, no text node separators
    expect(el.childNodes.length).toBe(1);
  });

  it('trims leading and trailing whitespace', () => {
    el.textContent = '  Padded Text  ';
    const words = splitTextIntoWords(el);
    expect(words.length).toBe(2);
    expect(el.getAttribute('aria-label')).toBe('Padded Text');
  });

  it('collapses multiple spaces between words', () => {
    el.textContent = 'Too   many    spaces';
    const words = splitTextIntoWords(el);
    expect(words.length).toBe(3);
    expect(words[0].textContent).toBe('Too');
    expect(words[1].textContent).toBe('many');
    expect(words[2].textContent).toBe('spaces');
  });

  it('replaces existing innerHTML', () => {
    el.innerHTML = '<em>Old</em> content';
    const words = splitTextIntoWords(el);
    expect(el.querySelectorAll('em').length).toBe(0);
    expect(words.length).toBe(2);
  });

  it('returns a NodeList of .word-inner elements', () => {
    el.textContent = 'Check Return Type';
    const result = splitTextIntoWords(el);
    expect(result).toBeInstanceOf(NodeList);
    result.forEach(node => {
      expect(node.classList.contains('word-inner')).toBe(true);
    });
  });
});

describe('splitTextIntoChars', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('h1');
  });

  it('splits text into individual character spans', () => {
    el.textContent = 'ABC';
    const chars = splitTextIntoChars(el);
    expect(chars.length).toBe(3);
    expect(chars[0].textContent).toBe('A');
    expect(chars[1].textContent).toBe('B');
    expect(chars[2].textContent).toBe('C');
  });

  it('sets aria-label to the original text', () => {
    el.textContent = 'Sircle';
    splitTextIntoChars(el);
    expect(el.getAttribute('aria-label')).toBe('Sircle');
  });

  it('replaces spaces with non-breaking spaces', () => {
    el.textContent = 'A B';
    const chars = splitTextIntoChars(el);
    expect(chars.length).toBe(3);
    expect(chars[1].textContent).toBe('\u00A0');
  });

  it('each char is wrapped in a .char span with inline-block', () => {
    el.textContent = 'Hi';
    splitTextIntoChars(el);
    const spans = el.querySelectorAll('.char');
    expect(spans.length).toBe(2);
    spans.forEach(span => {
      expect(span.style.display).toBe('inline-block');
    });
  });

  it('trims whitespace before splitting', () => {
    el.textContent = '  AB  ';
    const chars = splitTextIntoChars(el);
    expect(chars.length).toBe(2);
    expect(el.getAttribute('aria-label')).toBe('AB');
  });

  it('handles special characters', () => {
    el.textContent = '€100';
    const chars = splitTextIntoChars(el);
    expect(chars.length).toBe(4);
    expect(chars[0].textContent).toBe('€');
    expect(chars[1].textContent).toBe('1');
  });

  it('handles Dutch text with diacritics', () => {
    el.textContent = 'café';
    const chars = splitTextIntoChars(el);
    expect(chars.length).toBe(4);
    expect(chars[3].textContent).toBe('é');
  });

  it('returns a NodeList of .char elements', () => {
    el.textContent = 'XY';
    const result = splitTextIntoChars(el);
    expect(result).toBeInstanceOf(NodeList);
    result.forEach(node => {
      expect(node.classList.contains('char')).toBe(true);
    });
  });
});
