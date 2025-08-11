export type DriveNode = {
  id: string
  name: string
  type: "folder" | "file"
  mimeType?: string
  status: "Synced" | "In Progress" | "Not Synced"
  size?: number
  modifiedAt?: string
  subRows?: DriveNode[]
}

export const driveData: DriveNode[] = [
  {
    id: "root-1",
    name: "TwelveLabs Project",
    type: "folder",
    status: "Synced",
    subRows: [
      {
        id: "root-1-a",
        name: "Marketing",
        type: "folder",
        status: "In Progress",
        subRows: [
          {
            id: "root-1-a-1",
            name: "launch_plan.docx",
            type: "file",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            status: "Synced",
            size: 256000,
            modifiedAt: "2025-08-08T10:15:00Z",
          },
          {
            id: "root-1-a-2",
            name: "roadmap.pdf",
            type: "file",
            mimeType: "application/pdf",
            status: "Not Synced",
            size: 1048576,
            modifiedAt: "2025-08-01T08:00:00Z",
          },
        ],
      },
      {
        id: "root-1-b",
        name: "Videos",
        type: "folder",
        status: "In Progress",
        subRows: [
          {
            id: "root-1-b-1",
            name: "teaser.mp4",
            type: "file",
            mimeType: "video/mp4",
            status: "In Progress",
            size: 734003200,
            modifiedAt: "2025-08-06T13:30:00Z",
          },
          {
            id: "root-1-b-2",
            name: "demo.mov",
            type: "file",
            mimeType: "video/quicktime",
            status: "Synced",
            size: 1258291200,
            modifiedAt: "2025-08-03T09:45:00Z",
          },
        ],
      },
    ],
  },
  {
    id: "root-2",
    name: "Design",
    type: "folder",
    status: "Not Synced",
    subRows: [
      {
        id: "root-2-a",
        name: "logo.svg",
        type: "file",
        mimeType: "image/svg+xml",
        status: "Not Synced",
        size: 64000,
        modifiedAt: "2025-07-29T12:00:00Z",
      },
      {
        id: "root-2-b",
        name: "poster.png",
        type: "file",
        mimeType: "image/png",
        status: "Synced",
        size: 2097152,
        modifiedAt: "2025-08-02T17:20:00Z",
      },
    ],
  },
]


