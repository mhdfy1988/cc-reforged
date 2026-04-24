export type BillingType = string
export type RateLimitTier = string
export type SubscriptionType = string

export type OAuthTokenExchangeResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  account?: {
    uuid?: string
    email_address?: string
    organization_uuid?: string
    [key: string]: unknown
  }
  organization?: {
    uuid?: string
    organization_type?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type OAuthProfileResponse = {
  display_name?: string
  organization?: {
    organization_type?: string
    rate_limit_tier?: RateLimitTier | null
    has_extra_usage_enabled?: boolean | null
    billing_type?: BillingType | null
    account_created_at?: string | number
    subscription_created_at?: string | number
    organization_name?: string
    [key: string]: unknown
  }
  account?: {
    uuid?: string
    email_address?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type OAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt: number | null
  scopes: string[]
  subscriptionType?: SubscriptionType | null
  rateLimitTier?: RateLimitTier | null
  profile?: OAuthProfileResponse | null
  tokenAccount?: {
    uuid?: string
    emailAddress?: string
    organizationUuid?: string
  }
  [key: string]: unknown
}

export type UserRolesResponse = {
  roles?: string[]
  [key: string]: unknown
}

export type ReferralCampaign = string

export type ReferralEligibilityResponse = {
  eligible?: boolean
  [key: string]: unknown
}

export type ReferralRedemptionsResponse = {
  redemptions?: unknown[]
  [key: string]: unknown
}

export type ReferrerRewardInfo = {
  [key: string]: unknown
}

