from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.services import voucher_import_service, voucher_service

router = APIRouter(prefix="/vouchers", tags=["vouchers"])


# Pydantic Schemas
class VoucherTypeCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    badge_color: Optional[str] = "#0284c7"


class VoucherTypeUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    badge_color: Optional[str] = "#0284c7"
    is_active: bool = True


class VoucherOfferingCreate(BaseModel):
    voucher_type_id: int
    title: str
    price: Decimal
    validity_days: int = 180
    description: Optional[str] = None
    discount_price: Optional[Decimal] = None
    gst_rate_id: Optional[int] = None


class VoucherOfferingUpdate(BaseModel):
    title: str
    price: Decimal
    validity_days: int = 180
    description: Optional[str] = None
    discount_price: Optional[Decimal] = None
    gst_rate_id: Optional[int] = None
    is_active: bool = True


class VoucherManualCodeCreate(BaseModel):
    voucher_type_id: int
    codes: List[str]


class VoucherCodeBulkAction(BaseModel):
    code_ids: List[int]


class VoucherCodeUpdate(BaseModel):
    code: str
    voucher_type_id: int


class PublicVoucherPurchaseRequest(BaseModel):
    offering_id: int
    buyer_name: str
    buyer_email: str
    buyer_phone: Optional[str] = None
    gateway: Optional[str] = "demo"


# ==========================================
# PUBLIC & STUDENT ENDPOINTS
# ==========================================

@router.get("/public/offerings")
def get_public_voucher_offerings(db: Session = Depends(get_db)):
    """Fetch active voucher packages for landing page & student portal."""
    return voucher_service.list_voucher_offerings(db, include_inactive=False)


@router.post("/public/purchase")
def purchase_voucher_public(req: PublicVoucherPurchaseRequest, db: Session = Depends(get_db)):
    """Process instant payment and assign 16-digit voucher code."""
    if not req.buyer_name or not req.buyer_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name and Email are required")

    return voucher_service.process_voucher_purchase(
        db=db,
        offering_id=req.offering_id,
        buyer_name=req.buyer_name,
        buyer_email=req.buyer_email,
        buyer_phone=req.buyer_phone,
        student_user_id=None,
        gateway=req.gateway or "demo",
    )


@router.get("/student/my-vouchers")
def get_student_vouchers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all purchased vouchers for the logged-in student."""
    return voucher_service.get_student_purchased_vouchers(
        db=db,
        student_id=current_user.id,
        student_email=current_user.email,
    )


# ==========================================
# SUPER ADMIN ENDPOINTS
# ==========================================

def _require_super_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != SUPER_ADMIN and not getattr(current_user, "is_owner", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required")
    return current_user


@router.get("/admin/types")
def admin_get_voucher_types(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.list_voucher_types(db, include_inactive=True)


@router.post("/admin/types")
def admin_create_voucher_type(
    payload: VoucherTypeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.create_voucher_type(
        db=db,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        badge_color=payload.badge_color or "#0284c7",
    )


@router.put("/admin/types/{type_id}")
def admin_update_voucher_type(
    type_id: int,
    payload: VoucherTypeUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.update_voucher_type(
        db=db,
        type_id=type_id,
        name=payload.name,
        description=payload.description,
        badge_color=payload.badge_color or "#0284c7",
        is_active=payload.is_active,
    )


@router.get("/admin/offerings")
def admin_get_voucher_offerings(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.list_voucher_offerings(db, include_inactive=True)


@router.post("/admin/offerings")
def admin_create_voucher_offering(
    payload: VoucherOfferingCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.create_voucher_offering(
        db=db,
        voucher_type_id=payload.voucher_type_id,
        title=payload.title,
        price=payload.price,
        validity_days=payload.validity_days,
        description=payload.description,
        discount_price=payload.discount_price,
        gst_rate_id=payload.gst_rate_id,
    )


@router.put("/admin/offerings/{offering_id}")
def admin_update_voucher_offering(
    offering_id: int,
    payload: VoucherOfferingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.update_voucher_offering(
        db=db,
        offering_id=offering_id,
        title=payload.title,
        price=payload.price,
        validity_days=payload.validity_days,
        description=payload.description,
        discount_price=payload.discount_price,
        gst_rate_id=payload.gst_rate_id,
        is_active=payload.is_active,
    )


@router.post("/admin/bulk-upload")
async def admin_bulk_upload_voucher_codes(
    voucher_type_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    """Bulk upload PDF, Excel (.xlsx, .csv), DOCX, or TXT file to extract 16-digit voucher codes."""
    if not file or not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is required")

    content = await file.read()
    extracted_codes = voucher_import_service.extract_voucher_codes_from_bytes(file.filename, content)

    if not extracted_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid 16-digit alphanumeric voucher codes found in uploaded file",
        )

    result = voucher_service.add_bulk_voucher_codes(
        db=db,
        voucher_type_id=voucher_type_id,
        codes=extracted_codes,
        added_by_user_id=admin.id,
        filename=file.filename,
    )
    return result


@router.post("/admin/codes/manual")
def admin_manual_upload_voucher_codes(
    payload: VoucherManualCodeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    """Manually add 16-digit voucher codes."""
    if not payload.codes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No codes provided")
    
    clean_codes = [c.strip() for c in payload.codes if c.strip()]
    if not clean_codes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid codes provided")

    result = voucher_service.add_bulk_voucher_codes(
        db=db,
        voucher_type_id=payload.voucher_type_id,
        codes=clean_codes,
        added_by_user_id=admin.id,
        filename="Manual Entry",
    )
    return result


@router.get("/admin/codes/unused")
def admin_get_unused_codes(
    voucher_type_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    """List all unused voucher codes."""
    return voucher_service.list_unused_codes(db, voucher_type_id=voucher_type_id)


@router.patch("/admin/codes/{code_id}/disable")
def admin_disable_voucher_code(
    code_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.disable_voucher_code(db, code_id)


@router.patch("/admin/codes/{code_id}/toggle")
def admin_toggle_voucher_code(
    code_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.toggle_voucher_code(db, code_id)


@router.put("/admin/codes/{code_id}")
def admin_update_voucher_code(
    code_id: int,
    payload: VoucherCodeUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.update_voucher_code(db, code_id, payload.code, payload.voucher_type_id)


@router.post("/admin/codes/disable")
def admin_disable_voucher_codes(
    payload: VoucherCodeBulkAction,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.disable_voucher_codes(db, payload.code_ids)


@router.get("/admin/purchases")
def admin_get_voucher_purchases(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.list_admin_purchases(db, search=search)


@router.delete("/admin/types/{type_id}")
def admin_delete_voucher_type(
    type_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.delete_voucher_type(db, type_id)


@router.delete("/admin/offerings/{offering_id}")
def admin_delete_voucher_offering(
    offering_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.delete_voucher_offering(db, offering_id)


@router.delete("/admin/codes/{code_id}")
def admin_delete_voucher_code(
    code_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_super_admin),
):
    return voucher_service.delete_voucher_code(db, code_id)
