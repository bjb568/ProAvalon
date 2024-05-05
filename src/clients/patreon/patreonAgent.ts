import axios from 'axios';
import patreonId from '../../models/patreonId';
import { PatreonController, PatreonUserTokens } from './patreonController';

interface PatreonDetails {
  isActivePatreon: boolean;
  amountCents: number;
}

class PatreonAgent {
  private patreonController = new PatreonController();

  public getPatreonAuthorizationUrl() {
    return this.patreonController.loginUrl;
  }

  public async getExistingPatreonDetails(
    usernameLower: string,
  ): Promise<PatreonDetails> {
    // This function is to check for features in general on load

    const existingPatreon = await this.getExistingPatreon(usernameLower);

    if (!existingPatreon) {
      return null;
    }

    const isActivePatreon = !this.hasExpired(
      existingPatreon.currentPledgeExpiryDate,
    );

    return { isActivePatreon, amountCents: existingPatreon.amountCents };
  }

  // This path is hit whenever user clicks link to Patreon button
  public async linkUserToPatreon(
    usernameLower: string,
    code: string,
  ): Promise<PatreonDetails> {
    // Grab user tokens
    const tokens = await this.patreonController.getTokens(code);

    // Grab member details from Patreon with token
    const patronDetails = await this.patreonController.getPatronDetails(
      tokens.userAccessToken,
    );

    // Grab Patreon document from MongoDB
    const existingPatreon = await this.getExistingPatreon(usernameLower);

    // Do not let more than one patreon be used for same user
    if (
      existingPatreon &&
      existingPatreon.patreonUserId !== patronDetails.patreonUserId
    ) {
      throw new Error(
        'Attempted to upload a second Patreon for the same user.',
      );
    }

    // Do not let one patreon be used for more than one user
    const patreonAccountInUse = await patreonId.findOne({
      patreonUserId: patronDetails.patreonUserId,
    });
    if (
      patreonAccountInUse &&
      patreonAccountInUse.proavalonUsernameLower !== usernameLower
    ) {
      throw new Error(
        'Attempted to upload a used Patreon for more than one user.',
      );
    }

    let result: PatreonDetails;

    if (patronDetails.patreonMemberDetails) {
      // They are a current member
      result = await this.updateCurrentPatreonMember(
        existingPatreon,
        patronDetails,
        usernameLower,
        tokens,
      );
    } else {
      // They are not a current member to the Patreon page
      result = await this.updateCurrentNonPatreonMember(
        existingPatreon,
        tokens,
        usernameLower,
        patronDetails.patreonUserId,
      );
    }

    console.log(
      `Successfully linked Patreon account: proavalonUsernameLower="${usernameLower}" patreonUserId="${patronDetails.patreonUserId}" isActivePatreon="${result.isActivePatreon}" amountCents="${result.amountCents}"`,
    );

    return result;
  }

  private async updateCurrentPatreonMember(
    existingPatreon: any,
    patronDetails: any,
    usernameLower: string,
    tokens: PatreonUserTokens,
  ): Promise<PatreonDetails> {
    const amountCents =
      patronDetails.patreonMemberDetails.currently_entitled_amount_cents;
    const lastChargeDate = new Date(
      patronDetails.patreonMemberDetails.last_charge_date,
    );

    // Check payment received
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hasPaid =
      patronDetails.patreonMemberDetails.last_charge_status &&
      patronDetails.patreonMemberDetails.last_charge_status === 'Paid' &&
      lastChargeDate &&
      lastChargeDate > thirtyDaysAgo;
    const currentPledgeExpiryDate = hasPaid
      ? patronDetails.patreonMemberDetails.next_charge_date
      : null;

    const patreonUpdateDetails = {
      patreonUserId: patronDetails.patreonUserId,
      proavalonUsernameLower: usernameLower,
      userAccessToken: tokens.userAccessToken,
      userRefreshToken: tokens.userRefreshToken,
      userAccessTokenExpiry: tokens.userAccessTokenExpiry,
      amountCents,
      // TODO-kev: Check this is accurate
      currentPledgeExpiryDate: currentPledgeExpiryDate,
    };

    if (existingPatreon) {
      await patreonId.findOneAndUpdate(
        {
          proavalonUsernameLower: usernameLower,
        },
        patreonUpdateDetails,
      );
    } else {
      await patreonId.create(patreonUpdateDetails);
    }

    return {
      isActivePatreon: !this.hasExpired(currentPledgeExpiryDate),
      amountCents,
    };
  }

  private async updateCurrentNonPatreonMember(
    existingPatreon: any,
    tokens: PatreonUserTokens,
    usernameLower: string,
    patreonUserId: number,
  ): Promise<PatreonDetails> {
    if (existingPatreon) {
      existingPatreon.userAccessToken = tokens.userAccessToken;
      existingPatreon.userRefreshToken = tokens.userRefreshToken;
      existingPatreon.userAccessTokenExpiry = tokens.userAccessTokenExpiry;

      await existingPatreon.save();

      return { isActivePatreon: false, amountCents: 0 };
    }

    // TODO-kev: Can potentially remove this one so as to not store non member data
    await patreonId.create({
      patreonUserId: patreonUserId,
      proavalonUsernameLower: usernameLower,
      userAccessToken: tokens.userAccessToken,
      userRefreshToken: tokens.userRefreshToken,
      userAccessTokenExpiry: tokens.userAccessTokenExpiry,
      amountCents: 0,
      currentPledgeExpiryDate: null,
    });

    return { isActivePatreon: false, amountCents: 0 };
  }

  private hasExpired(expiryDate: Date) {
    return expiryDate < new Date();
  }

  private async getExistingPatreon(usernameLower: string) {
    const existingPatreon = await patreonId.findOne({
      proavalonUsernameLower: usernameLower,
    });

    return existingPatreon ? existingPatreon : null;
  }
}

export const patreonAgent = new PatreonAgent();
