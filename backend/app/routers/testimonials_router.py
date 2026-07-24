from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.role import SUPER_ADMIN
from app.models.testimonials import Testimonial
from app.schemas.testimonials import (
    TestimonialCreate,
    TestimonialResponse,
    TestimonialUpdate,
)

public_router = APIRouter(prefix="/testimonials", tags=["testimonials"])
admin_router = APIRouter(
    prefix="/super-admin/testimonials",
    tags=["admin-testimonials"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


@public_router.get("", response_model=List[TestimonialResponse])
def get_public_testimonials(db: Session = Depends(get_db)):
    stmt = (
        select(Testimonial)
        .where(Testimonial.is_active == True)
        .order_by(Testimonial.display_order.asc(), Testimonial.id.desc())
    )
    return db.scalars(stmt).all()


@admin_router.get("", response_model=List[TestimonialResponse])
def list_all_testimonials_admin(db: Session = Depends(get_db)):
    stmt = select(Testimonial).order_by(Testimonial.display_order.asc(), Testimonial.id.desc())
    return db.scalars(stmt).all()


from pydantic import BaseModel

class TestimonialReorderItem(BaseModel):
    id: int
    display_order: int

@admin_router.put("/reorder")
def reorder_testimonials_admin(items: List[TestimonialReorderItem], db: Session = Depends(get_db)):
    for item in items:
        t = db.get(Testimonial, item.id)
        if t:
            t.display_order = item.display_order
    db.commit()
    return {"message": "Reordered successfully"}


@admin_router.post("", response_model=TestimonialResponse, status_code=status.HTTP_201_CREATED)
def create_testimonial_admin(payload: TestimonialCreate, db: Session = Depends(get_db)):
    item = Testimonial(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@admin_router.put("/{testimonial_id}", response_model=TestimonialResponse)
def update_testimonial_admin(
    testimonial_id: int, payload: TestimonialUpdate, db: Session = Depends(get_db)
):
    item = db.get(Testimonial, testimonial_id)
    if not item:
        raise HTTPException(status_code=404, detail="Testimonial not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(item, key, val)

    db.commit()
    db.refresh(item)
    return item


@admin_router.delete("/{testimonial_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_testimonial_admin(testimonial_id: int, db: Session = Depends(get_db)):
    item = db.get(Testimonial, testimonial_id)
    if not item:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    db.delete(item)
    db.commit()
    return None
