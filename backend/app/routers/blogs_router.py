from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.blogs import BlogPost
from app.models.role import SUPER_ADMIN
from app.schemas.blogs import BlogPostCreate, BlogPostResponse, BlogPostUpdate

public_router = APIRouter(prefix="/blogs", tags=["blogs"])
admin_router = APIRouter(
    prefix="/super-admin/blogs",
    tags=["admin-blogs"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


@public_router.get("", response_model=List[BlogPostResponse])
def get_public_blogs(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(BlogPost).where(BlogPost.is_published == True)
    if category:
        stmt = stmt.where(BlogPost.category == category)
    if search:
        search_pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                BlogPost.title.ilike(search_pattern),
                BlogPost.summary.ilike(search_pattern),
                BlogPost.tags.ilike(search_pattern),
            )
        )
    stmt = stmt.order_by(BlogPost.created_at.desc())
    return db.scalars(stmt).all()


@public_router.get("/{slug}", response_model=BlogPostResponse)
def get_blog_by_slug(slug: str, db: Session = Depends(get_db)):
    stmt = select(BlogPost).where(BlogPost.slug == slug, BlogPost.is_published == True)
    post = db.scalar(stmt)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return post


@admin_router.get("", response_model=List[BlogPostResponse])
def list_all_blogs_admin(db: Session = Depends(get_db)):
    stmt = select(BlogPost).order_by(BlogPost.created_at.desc())
    return db.scalars(stmt).all()


@admin_router.post("", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_blog_admin(payload: BlogPostCreate, db: Session = Depends(get_db)):
    # Check if slug exists
    existing = db.scalar(select(BlogPost).where(BlogPost.slug == payload.slug))
    if existing:
        payload.slug = f"{payload.slug}-{int(datetime.utcnow().timestamp())}"

    item = BlogPost(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@admin_router.put("/{blog_id}", response_model=BlogPostResponse)
def update_blog_admin(blog_id: int, payload: BlogPostUpdate, db: Session = Depends(get_db)):
    item = db.get(BlogPost, blog_id)
    if not item:
        raise HTTPException(status_code=404, detail="Blog post not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(item, key, val)

    db.commit()
    db.refresh(item)
    return item


@admin_router.delete("/{blog_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blog_admin(blog_id: int, db: Session = Depends(get_db)):
    item = db.get(BlogPost, blog_id)
    if not item:
        raise HTTPException(status_code=404, detail="Blog post not found")
    db.delete(item)
    db.commit()
    return None
