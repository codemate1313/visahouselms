import glob

html_target = """            <sc-for list="{{ col.links }}" as="l" hint-placeholder-count="4">
              <a href="#" style="font-size: 14px; color: var(--ink); transition: color .2s;" style-hover="{color: 'var(--ac)'}">{{ l }}</a>
            </sc-for>"""

html_replace = """            <sc-for list="{{ col.links }}" as="l" hint-placeholder-count="4">
              <a href="{{ l.url }}" style="font-size: 14px; color: var(--ink); transition: color .2s;" style-hover="{color: 'var(--ac)'}">{{ l.label }}</a>
            </sc-for>"""

js_target = """      footerCols: [
        { title: "Showcase", links: ["Platform Home", "About Us", "Plans & Pricing", "Contact Support"] },
        { title: "Access Portals", links: ["Student Portal", "Institute Portal", "Instructor Portal", "Platform Admin"] },
        { title: "Partnerships", links: ["Request Demo", "For Institutes", "Resources", "Blog"] },
      ],"""

js_replace = """      footerCols: [
        { title: "Showcase", links: [
          { label: "Platform Home", url: "/dc-pages/Landing.dc.html" },
          { label: "About Us", url: "/dc-pages/About.dc.html" },
          { label: "Plans & Pricing", url: "/dc-pages/Plans.dc.html" },
          { label: "Contact Support", url: "/dc-pages/Contact.dc.html" }
        ]},
        { title: "Access Portals", links: [
          { label: "Student Portal", url: "/login?role=STUDENT" },
          { label: "Institute Portal", url: "/login?role=INSTITUTE_ADMIN" },
          { label: "Instructor Portal", url: "/login?role=INST_INSTRUCTOR" },
          { label: "Platform Admin", url: "/super-admin/login" }
        ]},
        { title: "Partnerships", links: [
          { label: "Request Demo", url: "/dc-pages/Contact.dc.html" },
          { label: "For Institutes", url: "/dc-pages/Landing.dc.html" },
          { label: "Resources", url: "/dc-pages/Blogs.dc.html" },
          { label: "Blog", url: "/dc-pages/Blogs.dc.html" }
        ]}
      ],"""

for f in glob.glob("/Users/dummy/Desktop/Visahouselms/frontend/public/dc-pages/*.dc.html"):
    with open(f, "r") as file:
        content = file.read()
    
    if html_target in content and js_target in content:
        content = content.replace(html_target, html_replace)
        content = content.replace(js_target, js_replace)
        with open(f, "w") as file:
            file.write(content)
        print(f"Updated {f}")
    else:
        print(f"Skipped {f} (did not match exact strings)")
