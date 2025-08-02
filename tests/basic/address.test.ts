import { describe, it, expect } from 'vitest';
import Address from '../../src/common/address.ts';

describe('Address', () => {
	describe('constructor', () => {
		it('Create Address from string array', () => {
			const addr = new Address(['a', 'b', 'c']);
			expect(addr.data).toEqual(['a', 'b', 'c']);
		});

		it('Create Address from Address', () => {
			const original = new Address(['x', 'y']);
			const copy = new Address(original);
			expect(copy.data).toEqual(['x', 'y']);
			expect(copy).not.toBe(original);
		});

		it('Throw error on invalid data', () => {
			expect(() => new Address(null as any)).toThrow("Invalid data to construct address");
		});
	});

	describe('equals()', () => {
		it('True for equal addresses', () => {
			const a1 = new Address(['x', 'y']);
			const a2 = new Address(['x', 'y']);
			expect(a1.equals(a2)).toBe(true);
		});

		it('False for non-equal addresses', () => {
			const a1 = new Address(['x', 'y']);
			const a2 = new Address(['x', 'z']);
			expect(a1.equals(a2)).toBe(false);
		});
	});

	describe('clone()', () => {
		it('Create independent clone', () => {
			const original = new Address(['a', 'b']);
			const cloned = original.clone();
			expect(cloned.equals(original)).toBe(true);
			expect(cloned).not.toBe(original);
		});
	});

	describe('isParentOf()', () => {
		it('True if Address is sub-address of another', () => {
			const parent = new Address(['a', 'b']);
			const child = new Address(['a', 'b', 'c']);
			expect(parent.isParentOf(child)).toBe(true);
		});

		it('False if Address is not sub-address of another', () => {
			const a = new Address(['a', 'x']);
			const b = new Address(['a', 'y', 'z']);
			expect(a.isParentOf(b)).toBe(false);
		});

		it('False if parent length is greater', () => {
			const long = new Address(['a', 'b', 'c']);
			const short = new Address(['a']);
			expect(long.isParentOf(short)).toBe(false);
		});
	});

	describe('toString()', () => {
		it('String conversion test', () => {
			const addr = new Address(['x', 'y', 'z']);
			expect(addr.toString()).toBe('[x, y, z]');
		});
	});

	describe('data getter/setter', () => {
		it('Data getter/setter', () => {
			const addr = new Address(['a']);
			addr.data = ['x', 'y'];
			expect(addr.data).toEqual(['x', 'y']);
		});
	});

	describe('parent getter', () => {
		it('Return parent address', () => {
			const addr = new Address(['a', 'b', 'c']);
			const parent = addr.parent;
			expect(parent.data).toEqual(['a', 'b']);
		});

		it('Parent address check', () => {
			const root = new Address(['root']);
			const parent = root.parent;
			expect(parent.data).toEqual([]);
		});
	});
});