import { describe, it, expect, beforeEach } from 'vitest';
import { getCurrencySymbol, toggle, $, $$ } from '../src/ui';

describe('UI utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('getCurrencySymbol', () => {
    it('returns $ for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });
    it('returns € for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });
    it('returns £ for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });
    it('returns code for unknown currency', () => {
      expect(getCurrencySymbol('JPY')).toBe('JPY');
    });
  });

  describe('toggle', () => {
    it('removes hidden class when show=true', () => {
      const el = document.createElement('div');
      el.classList.add('hidden');
      toggle(el, true);
      expect(el.classList.contains('hidden')).toBe(false);
    });
    it('adds hidden class when show=false', () => {
      const el = document.createElement('div');
      el.classList.remove('hidden');
      toggle(el, false);
      expect(el.classList.contains('hidden')).toBe(true);
    });
  });

  describe('$ and $$ selectors', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div class="container"><span class="item">A</span><span class="item">B</span></div>';
    });
    it('$(selector) returns first matching element', () => {
      const el = $('.container');
      expect(el).toBeInstanceOf(HTMLElement);
      expect(el.classList.contains('container')).toBe(true);
    });
    it('$$(selector) returns all matching elements', () => {
      const items = $$('.item');
      expect(items).toHaveLength(2);
      expect(Array.from(items).every(i => i.textContent === 'A' || i.textContent === 'B')).toBe(true);
    });
  });
});