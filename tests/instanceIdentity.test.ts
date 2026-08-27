import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSTANCE_IDENTITY,
  InstanceIdentityError,
  normalizeInstanceIdentity,
} from '../src/server/instanceIdentity';

describe('instance identity', () => {
  it('defaults to an unclaimed open-source installation', () => {
    expect(DEFAULT_INSTANCE_IDENTITY).toEqual({
      operatorName: null,
      contactEmail: null,
      communityUrl: null,
      communityLabel: 'Community',
      showCommunityLink: false,
      legalPagesEnabled: false,
      termsUrl: null,
      privacyUrl: null,
    });
  });

  it('normalizes public identity fields and http links', () => {
    expect(
      normalizeInstanceIdentity({
        operatorName: '  Example AB  ',
        contactEmail: 'contact@example.com',
        communityUrl: 'https://community.example.com',
        communityLabel: '  Forum  ',
        showCommunityLink: true,
        legalPagesEnabled: true,
        termsUrl: 'https://example.com/terms',
        privacyUrl: 'https://example.com/privacy',
      }),
    ).toEqual({
      operatorName: 'Example AB',
      contactEmail: 'contact@example.com',
      communityUrl: 'https://community.example.com/',
      communityLabel: 'Forum',
      showCommunityLink: true,
      legalPagesEnabled: true,
      termsUrl: 'https://example.com/terms',
      privacyUrl: 'https://example.com/privacy',
    });
  });

  it('cannot expose a community button without a configured URL', () => {
    expect(
      normalizeInstanceIdentity({
        ...DEFAULT_INSTANCE_IDENTITY,
        showCommunityLink: true,
      }).showCommunityLink,
    ).toBe(false);
  });

  it('rejects non-http public URLs', () => {
    expect(() =>
      normalizeInstanceIdentity({
        ...DEFAULT_INSTANCE_IDENTITY,
        communityUrl: 'javascript:alert(1)',
        showCommunityLink: true,
      }),
    ).toThrow(InstanceIdentityError);
  });

  it('rejects malformed contact email addresses', () => {
    expect(() =>
      normalizeInstanceIdentity({
        ...DEFAULT_INSTANCE_IDENTITY,
        contactEmail: 'not-an-email',
      }),
    ).toThrow(InstanceIdentityError);
  });
});
