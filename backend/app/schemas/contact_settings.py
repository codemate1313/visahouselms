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
    email: str = "enquiry.langugaecert@gmail.com"
    email_note: Optional[str] = "Replies within 1 working day"
    phone: str = "+91 9779047164"
    phone_note: Optional[str] = "Mon–Fri · 9am to 5pm IST"
    support_url: str = "support.visahouse.com (to be created)"
    support_note: Optional[str] = "Existing partners only"
    office_name: str = "Visa House Immigration"
    office_address: str = "Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001"

    # Head Office (Amritsar)
    head_office_name: Optional[str] = "Amritsar Office (Head Office)"
    head_office_address: Optional[str] = "Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001"
    head_office_map_link: Optional[str] = "https://www.google.com/maps/place/VISA+HOUSE+immigration/@31.65075,74.8629167,17z"
    head_office_map_embed: Optional[str] = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3692.6816320116436!2d74.8629167!3d31.65075!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3919650028ff0af9%3A0x7c60b7408534d94d!2sVISA%20HOUSE%20immigration!5e0!3m2!1sen!2sin!4v1786779632431!5m2!1sen!2sin"

    # Branch Office (Tarn Taran)
    branch_office_name: Optional[str] = "Tarn Taran Office (Branch Office)"
    branch_office_address: Optional[str] = "Gali Lakeer Sahib Wali, Amritsar Bypass Road, Tarn Taran, Punjab 143401"
    branch_office_map_link: Optional[str] = "https://maps.app.goo.gl/9DfwXmJcfyzQnwC67"
    branch_office_map_embed: Optional[str] = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3403.475908208477!2d74.9170435!3d31.4638482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39197f991e05cd0f%3A0x64c8d99f3ec4c656!2sVisa%20House!5e0!3m2!1sen!2sin!4v1786779800000!5m2!1sen!2sin"


class ContactInfoUpdate(BaseModel):
    email: Optional[str] = None
    email_note: Optional[str] = None
    phone: Optional[str] = None
    phone_note: Optional[str] = None
    support_url: Optional[str] = None
    support_note: Optional[str] = None
    office_name: Optional[str] = None
    office_address: Optional[str] = None

    head_office_name: Optional[str] = None
    head_office_address: Optional[str] = None
    head_office_map_link: Optional[str] = None
    head_office_map_embed: Optional[str] = None

    branch_office_name: Optional[str] = None
    branch_office_address: Optional[str] = None
    branch_office_map_link: Optional[str] = None
    branch_office_map_embed: Optional[str] = None


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
