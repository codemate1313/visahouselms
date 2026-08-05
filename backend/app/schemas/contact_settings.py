from datetime import datetime
from typing import Optional
from pydantic import BaseModel


SOCIAL_PLATFORMS = (
    "linkedin",
    "github",
    "instagram",
    "youtube",
    "facebook",
    "twitter",
    "tiktok",
    "website",
)


class ContactInfoBase(BaseModel):
    email: str = "partners@visahouse.io"
    email_note: Optional[str] = "Replies within 1 working day"
    phone: str = "+91 80 4700 8100"
    phone_note: Optional[str] = "Mon–Fri · 10am to 7pm IST"
    support_url: str = "support.visahouse.io"
    support_note: Optional[str] = "Existing partners only"
    office_name: str = "Visa House Learning Pvt. Ltd."
    office_address: str = "4th Floor, Prestige Meridian,\nMG Road, Bangalore 560001"


class ContactInfoUpdate(BaseModel):
    email: Optional[str] = None
    email_note: Optional[str] = None
    phone: Optional[str] = None
    phone_note: Optional[str] = None
    support_url: Optional[str] = None
    support_note: Optional[str] = None
    office_name: Optional[str] = None
    office_address: Optional[str] = None


class ContactInfoResponse(ContactInfoBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SocialLinkCreate(BaseModel):
    platform: str
    url: str
    is_enabled: bool = True


class SocialLinkUpdate(BaseModel):
    platform: Optional[str] = None
    url: Optional[str] = None
    is_enabled: Optional[bool] = None


class SocialLinkOut(BaseModel):
    id: int
    platform: str
    url: str
    is_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ContactSettingsPublic(BaseModel):
    contact: ContactInfoResponse
    social_links: list[SocialLinkOut]


class ContactSettingsAdmin(BaseModel):
    contact: ContactInfoResponse
    social_links: list[SocialLinkOut]
