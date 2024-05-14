import {
  IPatreonController,
  MultiplePatreonsForUserError,
  MultipleUsersForPatreonError,
  PatreonAgent,
  PatreonUserTokens,
  PaidPatronFullDetails,
  NotPaidPatronError,
} from '../patreonAgent';
import mock = jest.mock;

const EXPIRED_DATE = new Date(new Date().getTime() - 60 * 60 * 1000); // 1 hour prior
const NOT_EXPIRED_DATE = new Date(new Date().getTime() + 60 * 60 * 1000); // 1 hour after

class MockPatreonController implements IPatreonController {
  getPatreonUserTokens = jest.fn();
  refreshPatreonUserTokens = jest.fn();
  getPaidPatronFullDetails = jest.fn();
  getLoginUrl = jest.fn();

  clear() {
    this.getPatreonUserTokens.mockClear();
    this.getPaidPatronFullDetails.mockClear();
    this.getLoginUrl.mockClear();
    this.refreshPatreonUserTokens.mockClear();
  }
}

describe('PatreonAgent', () => {
  let patreonAgent: PatreonAgent;
  const mockPatreonController = new MockPatreonController();

  beforeEach(() => {
    mockPatreonController.clear();

    patreonAgent = new PatreonAgent(mockPatreonController);
  });

  describe('Links user to Patreon', () => {
    const patreonUserTokens: PatreonUserTokens = {
      userAccessToken: 'accessAbc',
      userRefreshToken: 'refresh456',
      userAccessTokenExpiry: NOT_EXPIRED_DATE,
    };

    const paidPatronFullDetails: PaidPatronFullDetails = {
      patreonUserId: '123456789',
      amountCents: 100,
      currentPledgeExpiryDate: NOT_EXPIRED_DATE,
    };

    let mockGetPatreonRecordFromUsername: any;
    let mockGetPatreonRecordFromPatreonId: any;
    let mockUpdateCurrentPaidPatreonMember: any;

    beforeEach(() => {
      mockPatreonController.clear();
      patreonAgent = new PatreonAgent(mockPatreonController);

      mockGetPatreonRecordFromUsername = jest.spyOn(
        patreonAgent as any,
        'getPatreonRecordFromUsername',
      );

      mockGetPatreonRecordFromPatreonId = jest.spyOn(
        patreonAgent as any,
        'getPatreonRecordFromPatreonId',
      );

      mockUpdateCurrentPaidPatreonMember = jest.spyOn(
        patreonAgent as any,
        'updateCurrentPaidPatreonMember',
      );
    });

    it('Links a paid Patreon account to a user', async () => {
      mockPatreonController.getPatreonUserTokens.mockResolvedValueOnce(
        patreonUserTokens,
      );
      mockPatreonController.getPaidPatronFullDetails.mockResolvedValueOnce(
        paidPatronFullDetails,
      );
      mockGetPatreonRecordFromUsername.mockResolvedValueOnce(null);
      mockGetPatreonRecordFromPatreonId.mockResolvedValueOnce(null);
      mockUpdateCurrentPaidPatreonMember.mockResolvedValueOnce({
        patreonUserId: '123456789',
        isPledgeActive: true,
        amountCents: 100,
      });

      const result = await patreonAgent.linkUserToPatreon(
        'usernamelow',
        'codeAbc',
      );

      expect(result).toStrictEqual({
        patreonUserId: '123456789',
        isPledgeActive: true,
        amountCents: 100,
      });

      expect(mockPatreonController.getPatreonUserTokens).toHaveBeenCalledWith(
        'codeAbc',
      );

      expect(
        mockPatreonController.getPaidPatronFullDetails,
      ).toHaveBeenCalledWith('accessAbc');

      expect(mockGetPatreonRecordFromUsername).toHaveBeenCalledWith(
        'usernamelow',
      );

      expect(mockGetPatreonRecordFromPatreonId).toHaveBeenCalledWith(
        '123456789',
      );

      expect(mockUpdateCurrentPaidPatreonMember).toHaveBeenCalledWith(
        null,
        paidPatronFullDetails,
        'usernamelow',
        patreonUserTokens,
      );
    });

    it('Does not link an unpaid Patreon account to a user', async () => {
      mockPatreonController.getPatreonUserTokens.mockResolvedValueOnce(
        patreonUserTokens,
      );
      mockPatreonController.getPaidPatronFullDetails.mockResolvedValueOnce(
        null,
      );

      await expect(
        patreonAgent.linkUserToPatreon('usernamelow', 'codeAbc'),
      ).rejects.toThrowError(NotPaidPatronError);

      expect(mockPatreonController.getPatreonUserTokens).toHaveBeenCalledWith(
        'codeAbc',
      );

      expect(
        mockPatreonController.getPaidPatronFullDetails,
      ).toHaveBeenCalledWith('accessAbc');
    });

    it('Does not allow multiple Patreon accounts to be linked to a user', async () => {
      mockPatreonController.getPatreonUserTokens.mockResolvedValueOnce(
        patreonUserTokens,
      );
      mockPatreonController.getPaidPatronFullDetails.mockResolvedValueOnce(
        paidPatronFullDetails,
      );
      mockGetPatreonRecordFromUsername.mockResolvedValueOnce({
        patreonUserId: '987654321',
        proavalonUsernameLower: 'usernamelow',
        userAccessToken: 'String',
        userAccessTokenExpiry: NOT_EXPIRED_DATE,
        userRefreshToken: 'String',
        amountCents: 0,
        currentPledgeExpiryDate: NOT_EXPIRED_DATE,
      });

      await expect(
        patreonAgent.linkUserToPatreon('usernamelow', 'codeAbc'),
      ).rejects.toThrowError(MultiplePatreonsForUserError);

      expect(mockPatreonController.getPatreonUserTokens).toHaveBeenCalledWith(
        'codeAbc',
      );

      expect(
        mockPatreonController.getPaidPatronFullDetails,
      ).toHaveBeenCalledWith('accessAbc');

      expect(mockGetPatreonRecordFromUsername).toHaveBeenCalledWith(
        'usernamelow',
      );
    });

    it('Does not allow multiple users to link the same Patreon account', async () => {
      mockPatreonController.getPatreonUserTokens.mockResolvedValueOnce(
        patreonUserTokens,
      );
      mockPatreonController.getPaidPatronFullDetails.mockResolvedValueOnce(
        paidPatronFullDetails,
      );
      mockGetPatreonRecordFromUsername.mockResolvedValueOnce(null);
      mockGetPatreonRecordFromPatreonId.mockResolvedValueOnce({
        patreonUserId: '123456789',
        proavalonUsernameLower: 'anotherUsername',
        userAccessToken: 'accessABC',
        userAccessTokenExpiry: NOT_EXPIRED_DATE,
        userRefreshToken: 'refreshABC',
        amountCents: 0,
        currentPledgeExpiryDate: NOT_EXPIRED_DATE,
      });

      await expect(
        patreonAgent.linkUserToPatreon('usernamelow', 'codeAbc'),
      ).rejects.toThrowError(MultipleUsersForPatreonError);

      expect(mockPatreonController.getPatreonUserTokens).toHaveBeenCalledWith(
        'codeAbc',
      );

      expect(
        mockPatreonController.getPaidPatronFullDetails,
      ).toHaveBeenCalledWith('accessAbc');

      expect(mockGetPatreonRecordFromUsername).toHaveBeenCalledWith(
        'usernamelow',
      );

      expect(mockGetPatreonRecordFromPatreonId).toHaveBeenCalledWith(
        '123456789',
      );
    });
  });

  describe('Gets user Patreon details from local database', () => {
    let mockGetPatreonRecordFromUsername: any;

    beforeEach(() => {
      mockPatreonController.clear();
      patreonAgent = new PatreonAgent(mockPatreonController);

      mockGetPatreonRecordFromUsername = jest.spyOn(
        patreonAgent as any,
        'getPatreonRecordFromUsername',
      );
    });

    it('Returns null if no Patreon Record in database', async () => {
      mockGetPatreonRecordFromUsername.mockResolvedValueOnce(null);
      const result = await patreonAgent.findOrUpdateExistingPatronDetails(
        'usernamelow',
      );

      expect(result).toEqual(null);
      expect(mockGetPatreonRecordFromUsername).toHaveBeenCalledWith(
        'usernamelow',
      );
    });

    it('Gets active Patreon details from local database', async () => {
      mockGetPatreonRecordFromUsername.mockResolvedValueOnce({
        patreonUserId: '123456789',
        proavalonUsernameLower: 'usernamelow',
        userAccessToken: 'accessABC',
        userAccessTokenExpiry: NOT_EXPIRED_DATE,
        userRefreshToken: 'refreshABC',
        amountCents: 300,
        currentPledgeExpiryDate: NOT_EXPIRED_DATE,
      });

      const result = await patreonAgent.findOrUpdateExistingPatronDetails(
        'usernamelow',
      );
      expect(result).toStrictEqual({
        patreonUserId: '123456789',
        isPledgeActive: true,
        amountCents: 300,
      });

      expect(mockGetPatreonRecordFromUsername).toHaveBeenCalledWith(
        'usernamelow',
      );
    });

    it('Retrieves an expired Patreon details and updates it if paid', async () => {
      const mockPatronRecord = {
        patreonUserId: '123456789',
        proavalonUsernameLower: 'usernamelow',
        userAccessToken: 'oldAccessToken',
        userAccessTokenExpiry: EXPIRED_DATE,
        userRefreshToken: 'oldRefreshToken',
        amountCents: 300,
        currentPledgeExpiryDate: EXPIRED_DATE,
        save: jest.fn(),
        deleteOne: jest.fn(),
      };

      mockGetPatreonRecordFromUsername.mockResolvedValueOnce(mockPatronRecord);
      mockPatreonController.refreshPatreonUserTokens.mockResolvedValueOnce({
        userAccessToken: 'newAccessToken',
        userRefreshToken: 'newRefreshToken',
        userAccessTokenExpiry: NOT_EXPIRED_DATE,
      });
      mockPatreonController.getPaidPatronFullDetails.mockResolvedValueOnce({
        patreonUserId: '123456789',
        isPaidPatron: true,
        amountCents: 400,
        currentPledgeExpiryDate: NOT_EXPIRED_DATE,
      });

      const result = await patreonAgent.findOrUpdateExistingPatronDetails(
        'usernamelow',
      );
      expect(result).toStrictEqual({
        patreonUserId: '123456789',
        isPledgeActive: true,
        amountCents: 400,
      });

      expect(mockGetPatreonRecordFromUsername).toHaveBeenCalledWith(
        'usernamelow',
      );
      expect(
        mockPatreonController.refreshPatreonUserTokens,
      ).toHaveBeenCalledWith('oldRefreshToken');
      expect(
        mockPatreonController.getPaidPatronFullDetails,
      ).toHaveBeenCalledWith('newAccessToken');
      expect(mockPatronRecord.save).toHaveBeenCalled();
    });

    it('Retrieves an expired Patreon details and deletes it if no longer paid', async () => {
      const mockUpdateUserTokens = jest.spyOn(
        patreonAgent as any,
        'updateUserTokens',
      );

      const mockPatreonRecord = {
        patreonUserId: '123456789',
        proavalonUsernameLower: 'usernamelow',
        userAccessToken: 'oldAccessToken',
        userAccessTokenExpiry: EXPIRED_DATE,
        userRefreshToken: 'oldRefreshToken',
        amountCents: 300,
        currentPledgeExpiryDate: EXPIRED_DATE,
        save: jest.fn(),
        deleteOne: jest.fn(),
      };

      const mockNewUserTokens = {
        userAccessToken: 'newAccessToken',
        userRefreshToken: 'newRefreshToken',
        userAccessTokenExpiry: NOT_EXPIRED_DATE,
      };

      mockGetPatreonRecordFromUsername.mockResolvedValueOnce(mockPatreonRecord);
      mockPatreonController.refreshPatreonUserTokens.mockResolvedValueOnce(
        mockNewUserTokens,
      );
      mockPatreonController.getPaidPatronFullDetails.mockResolvedValueOnce(
        null,
      );

      const result = await patreonAgent.findOrUpdateExistingPatronDetails(
        'usernamelow',
      );
      expect(result).toStrictEqual({
        patreonUserId: '123456789',
        isPledgeActive: false,
        amountCents: 0,
      });

      expect(mockGetPatreonRecordFromUsername).toHaveBeenCalledWith(
        'usernamelow',
      );

      expect(
        mockPatreonController.refreshPatreonUserTokens,
      ).toHaveBeenCalledWith('oldRefreshToken');

      expect(mockUpdateUserTokens).toHaveBeenCalledWith(
        mockPatreonRecord,
        mockNewUserTokens,
      );

      expect(
        mockPatreonController.getPaidPatronFullDetails,
      ).toHaveBeenCalledWith('newAccessToken');

      expect(mockPatreonRecord.deleteOne).toHaveBeenCalled();
    });
  });
});